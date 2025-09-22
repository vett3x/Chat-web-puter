export const runtime = 'nodejs'; // Force Node.js runtime

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { SUPERUSER_EMAILS, PERMISSION_KEYS, UserPermissions } from '@/lib/constants'; // Importar PERMISSION_KEYS

// Esquema de validación para actualizar permisos
const updatePermissionsSchema = z.object({
  permissions: z.record(z.string(), z.boolean()), // Un objeto donde las claves son strings y los valores son booleanos
});

async function getSessionAndRole(): Promise<{ session: any; userRole: 'user' | 'admin' | 'super_admin' | null; userPermissions: UserPermissions }> {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) {},
        remove(name: string, options: CookieOptions) {},
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

export async function GET(
  req: NextRequest,
  context: any
) {
  try {
    const userIdToFetch = context.params.id;

    if (!userIdToFetch) {
      return NextResponse.json({ message: 'ID de usuario no proporcionado.' }, { status: 400 });
    }

    const { session, userRole: currentUserRole } = await getSessionAndRole();
    // Solo los Super Admins pueden ver los permisos de otros usuarios
    if (!session || currentUserRole !== 'super_admin') {
      return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden ver permisos.' }, { status: 403 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables.');
      return NextResponse.json({ message: 'Error de configuración del servidor.' }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile, error: fetchProfileError } = await supabaseAdmin
      .from('profiles')
      .select('permissions')
      .eq('id', userIdToFetch)
      .single();

    if (fetchProfileError || !profile) {
      console.error(`Error fetching permissions for user ${userIdToFetch}:`, fetchProfileError);
      return NextResponse.json({ message: 'Usuario no encontrado o permisos no disponibles.' }, { status: 404 });
    }

    return NextResponse.json({ permissions: profile.permissions || {} }, { status: 200 });

  } catch (error: any) {
    console.error('Unhandled error in GET /api/users/[id]/permissions:', error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: any // Simplified type to resolve internal Next.js type conflict
) {
  try { // Bloque try-catch global para capturar cualquier error
    const userIdToUpdate = context.params.id;

    if (!userIdToUpdate) {
      return NextResponse.json({ message: 'ID de usuario no proporcionado.' }, { status: 400 });
    }

    const { session, userRole: currentUserRole } = await getSessionAndRole();
    // Solo los Super Admins pueden actualizar permisos
    if (!session || currentUserRole !== 'super_admin') {
      return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden cambiar permisos.' }, { status: 403 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables.');
      return NextResponse.json({ message: 'Error de configuración del servidor.' }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      const body = await req.json();
      const { permissions: newPermissions } = updatePermissionsSchema.parse(body);

      // Obtener el perfil del usuario objetivo para verificar su rol
      const { data: targetProfile, error: fetchProfileError } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userIdToUpdate)
        .single();

      if (fetchProfileError || !targetProfile) {
        console.error(`Error fetching target user profile ${userIdToUpdate}:`, fetchProfileError);
        return NextResponse.json({ message: 'Usuario objetivo no encontrado.' }, { status: 404 });
      }

      // Un Super Admin no puede cambiar sus propios permisos
      if (session.user.id === userIdToUpdate) {
        return NextResponse.json({ message: 'No puedes cambiar tus propios permisos de Super Admin.' }, { status: 403 });
      }

      // Un Super Admin no puede cambiar los permisos de otro Super Admin
      if (targetProfile.role === 'super_admin') {
        return NextResponse.json({ message: 'No puedes cambiar los permisos de otro Super Admin.' }, { status: 403 });
      }

      // Validar que solo se intenten cambiar permisos definidos en PERMISSION_KEYS
      const allowedPermissionKeys = Object.values(PERMISSION_KEYS);
      for (const key in newPermissions) {
        if (!allowedPermissionKeys.includes(key)) {
          return NextResponse.json({ message: `Permiso desconocido: '${key}'.` }, { status: 400 });
        }
      }

      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({ permissions: newPermissions })
        .eq('id', userIdToUpdate)
        .select('id, permissions')
        .single();

      if (error) {
        console.error(`Error updating permissions for user ${userIdToUpdate}:`, error);
        await supabaseAdmin.from('server_events_log').insert({
          user_id: session.user.id,
          event_type: 'user_permissions_update_failed',
          description: `Fallo al actualizar permisos del usuario ${userIdToUpdate}. Error: ${error.message}`,
        });
        throw new Error(`Error al actualizar los permisos del usuario: ${error.message}`);
      }

      await supabaseAdmin.from('server_events_log').insert({
        user_id: session.user.id,
        event_type: 'user_permissions_updated',
        description: `Permisos del usuario ${userIdToUpdate} actualizados por Super Admin '${session.user.email}'.`,
      });

      return NextResponse.json({ message: 'Permisos de usuario actualizados correctamente.', user: data }, { status: 200 });

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
      }
      console.error('Unhandled error in PUT /api/users/[id]/permissions (inner catch):', error);
      return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
    }
  } catch (outerError: any) {
    console.error('Unhandled error in PUT /api/users/[id]/permissions (outer catch):', outerError);
    return NextResponse.json({ message: outerError.message || 'Error interno del servidor (inesperado).' }, { status: 500 });
  }
}