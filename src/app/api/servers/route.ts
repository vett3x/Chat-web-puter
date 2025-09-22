export const runtime = 'nodejs'; // Force Node.js runtime

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { provisionServer } from '@/lib/server-provisioning';
import { SUPERUSER_EMAILS, UserPermissions, PERMISSION_KEYS } from '@/lib/constants'; // Importación actualizada
import { executeSshCommand } from '@/lib/ssh-utils'; // Import SSH utilities

// Esquema de validación para añadir un servidor
const serverSchema = z.object({
  ip_address: z.string().ip({ message: 'Dirección IP inválida.' }),
  ssh_username: z.string().min(1, { message: 'El usuario SSH es requerido.' }),
  ssh_password: z.string().min(1, { message: 'La contraseña SSH es requerida.' }),
  ssh_port: z.coerce.number().int().min(1).max(65535).default(22).optional(),
  name: z.string().optional(),
});

// Helper function to get the session and user role
async function getSessionAndRole(): Promise<{ session: any; userRole: 'user' | 'admin' | 'super_admin' | null; userPermissions: UserPermissions }> {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // In a Route Handler, the cookie store is read-only.
        },
        remove(name: string, options: CookieOptions) {
          // In a Route Handler, the cookie store is read-only.
        },
      },
    }
  );
  const { data: { session } } = await supabase.auth.getSession();

  let userRole: 'user' | 'admin' | 'super_admin' | null = null;
  let userPermissions: UserPermissions = {};

  if (session?.user?.id) {
    // First, determine the role, prioritizing SUPERUSER_EMAILS
    if (session.user.email && SUPERUSER_EMAILS.includes(session.user.email)) {
      userRole = 'super_admin';
    } else {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role') // Only need role for initial determination
        .eq('id', session.user.id)
        .single();
      if (profile) {
        userRole = profile.role as 'user' | 'admin' | 'super_admin';
      } else {
        userRole = 'user'; // Default to user if no profile found and not superuser email
      }
    }

    // Then, fetch permissions from profile, or set all if super_admin
    if (userRole === 'super_admin') {
      for (const key of Object.values(PERMISSION_KEYS)) {
        userPermissions[key] = true;
      }
    } else {
      const { data: profilePermissions, error: permissionsError } = await supabase
        .from('profiles')
        .select('permissions')
        .eq('id', session.user.id)
        .single();
      if (profilePermissions) {
        userPermissions = profilePermissions.permissions || {};
      } else {
        // Default permissions for non-super-admin if profile fetch failed
        userPermissions = {
          [PERMISSION_KEYS.CAN_CREATE_SERVER]: false,
          [PERMISSION_KEYS.CAN_MANAGE_DOCKER_CONTAINERS]: false,
          [PERMISSION_KEYS.CAN_MANAGE_CLOUDFLARE_DOMAINS]: false,
          [PERMISSION_KEYS.CAN_MANAGE_CLOUDFLARE_TUNNELS]: false,
        };
      }
    }
  }
  return { session, userRole, userPermissions };
}

// GET /api/servers - Obtener la lista de servidores registrados
export async function GET(req: NextRequest) {
  const { session, userRole, userPermissions } = await getSessionAndRole();
  if (!session || !userRole) {
    return NextResponse.json({ message: 'Acceso denegado. No autenticado.' }, { status: 401 });
  }
  // Allow Admins and Super Admins to view servers
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return NextResponse.json({ message: 'Acceso denegado. Se requiere rol de Admin o Super Admin.' }, { status: 403 });
  }

  // Check for SUPABASE_SERVICE_ROLE_KEY
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables.');
    return NextResponse.json({ message: 'Error de configuración del servidor: Clave de servicio de Supabase no encontrada.' }, { status: 500 });
  }

  // Use admin client to bypass RLS, relying on the role check for security
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let query = supabaseAdmin
    .from('user_servers')
    .select('id, name, ip_address, ssh_port, ssh_username, status, provisioning_log');

  // Both Admins and Super Admins see all servers, so no user_id filter is applied here.

  const { data: servers, error } = await query;

  if (error) {
    console.error('Error fetching servers from Supabase (admin):', JSON.stringify(error, null, 2));
    return NextResponse.json({ message: 'Error al cargar los servidores.' }, { status: 500 });
  }

  return NextResponse.json(servers, { status: 200 });
}

// POST /api/servers - Añadir un nuevo servidor y empezar el aprovisionamiento
export async function POST(req: NextRequest) {
  const { session, userRole, userPermissions } = await getSessionAndRole();
  if (!session || !userRole) {
    return NextResponse.json({ message: 'Acceso denegado. No autenticado.' }, { status: 401 });
  }
  // Check for granular permission: can_create_server
  if (!userPermissions[PERMISSION_KEYS.CAN_CREATE_SERVER]) {
    return NextResponse.json({ message: 'Acceso denegado. No tienes permiso para añadir servidores.' }, { status: 403 });
  }

  // Check for SUPABASE_SERVICE_ROLE_KEY
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables.');
    return NextResponse.json({ message: 'Error de configuración del servidor: Clave de servicio de Supabase no encontrada.' }, { status: 500 });
  }

  // Use admin client to bypass RLS
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const body = await req.json();
    const newServerData = serverSchema.parse(body);

    const { data: newServer, error } = await supabaseAdmin
      .from('user_servers')
      .insert({
        user_id: session.user.id,
        name: newServerData.name,
        ip_address: newServerData.ip_address,
        ssh_port: newServerData.ssh_port || 22,
        ssh_username: newServerData.ssh_username,
        ssh_password: newServerData.ssh_password,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting server into Supabase (admin):', error);
      // Log event for failed server addition
      await supabaseAdmin.from('server_events_log').insert({
        user_id: session.user.id,
        event_type: 'server_add_failed',
        description: `Fallo al añadir servidor: ${newServerData.name || newServerData.ip_address}. Error: ${error.message}`,
      });
      return NextResponse.json({ message: 'Error al guardar el servidor.' }, { status: 500 });
    }

    // Log event for successful server addition
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      server_id: newServer.id,
      event_type: 'server_added',
      description: `Servidor '${newServer.name || newServer.ip_address}' añadido.`,
    });

    // Start provisioning in the background (don't await)
    provisionServer(newServer);

    return NextResponse.json(
      { message: 'Servidor añadido. El aprovisionamiento ha comenzado en segundo plano.', server: newServer },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error('Error al añadir servidor:', error);
    // Log event for general error during server addition
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      event_type: 'server_add_failed',
      description: `Error inesperado al añadir servidor: ${error.message}`,
    });
    return NextResponse.json({ message: 'Error interno del servidor.' }, { status: 500 });
  }
}

// DELETE /api/servers - Eliminar un servidor
export async function DELETE(req: NextRequest) {
  const { session, userRole, userPermissions } = await getSessionAndRole();
  if (!session || !userRole) {
    return NextResponse.json({ message: 'Acceso denegado. No autenticado.' }, { status: 401 });
  }
  // Only Super Admins can delete servers
  if (userRole !== 'super_admin') {
    return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden eliminar servidores.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'ID de servidor no proporcionado.' }, { status: 400 });
  }

  // Check for SUPABASE_SERVICE_ROLE_KEY
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables.');
    return NextResponse.json({ message: 'Error de configuración del servidor: Clave de servicio de Supabase no encontrada.' }, { status: 500 });
  }

  // Use admin client to bypass RLS
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // First, get server details for logging
  const { data: serverToDelete, error: fetchServerError } = await supabaseAdmin
    .from('user_servers')
    .select('name, ip_address')
    .eq('id', id)
    .single(); // Removed user_id filter here as Super Admins can delete any server

  if (fetchServerError || !serverToDelete) {
    console.error('Error fetching server to delete:', fetchServerError);
    // Log event for failed server deletion (server not found or access denied)
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      server_id: id,
      event_type: 'server_delete_failed',
      description: `Fallo al eliminar servidor con ID ${id}: no encontrado o acceso denegado.`,
    });
    return NextResponse.json({ message: 'Servidor no encontrado o acceso denegado.' }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from('user_servers')
    .delete()
    .eq('id', id); // Removed user_id filter here as Super Admins can delete any server

  if (error) {
    console.error('Error deleting server from Supabase (admin):', error);
    // Log event for failed server deletion
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      server_id: id,
      event_type: 'server_delete_failed',
      description: `Fallo al eliminar servidor '${serverToDelete.name || serverToDelete.ip_address}'. Error: ${error.message}`,
    });
    return NextResponse.json({ message: 'Error al eliminar el servidor.' }, { status: 500 });
  }

  // Log event for successful server deletion
  await supabaseAdmin.from('server_events_log').insert({
    user_id: session.user.id,
    server_id: id,
    event_type: 'server_deleted',
    description: `Servidor '${serverToDelete.name || serverToDelete.ip_address}' eliminado.`,
  });

  return NextResponse.json({ message: 'Servidor eliminado correctamente.' }, { status: 200 });
}