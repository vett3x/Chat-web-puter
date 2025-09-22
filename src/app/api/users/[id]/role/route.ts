export const runtime = 'nodejs'; // Force Node.js runtime

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { SUPERUSER_EMAILS, UserPermissions } from '@/lib/constants'; // Importación actualizada

const updateRoleSchema = z.object({
  role: z.enum(['user', 'admin', 'super_admin'], { message: 'Rol inválido.' }),
});

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
        set(name: string, value: string, options: CookieOptions) {},
        remove(name: string, options: CookieOptions) {},
      },
    }
  );
  const { data: { session } } = await supabase.auth.getSession();

  let userRole: 'user' | 'admin' | 'super_admin' | null = null;
  let userPermissions: UserPermissions = {};
  if (session?.user?.id) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role, permissions')
      .eq('id', session.user.id)
      .single();
    if (profile) {
      userRole = profile.role as 'user' | 'admin' | 'super_admin';
      userPermissions = profile.permissions || {};
    } else if (session.user.email && SUPERUSER_EMAILS.includes(session.user.email)) {
      userRole = 'super_admin'; // Fallback for initial Super Admin
      userPermissions = {
        can_create_server: true,
        can_manage_docker_containers: true,
        can_manage_cloudflare_domains: true,
        can_manage_cloudflare_tunnels: true,
      };
    }
  }
  return { session, userRole, userPermissions };
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

    const { session } = await getSessionAndRole(); // <-- Corrección aquí: desestructuración directa de 'session'
    // Solo los Super Admins pueden actualizar roles
    if (!session || !session.user?.email || !SUPERUSER_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden cambiar roles.' }, { status: 403 });
    }

    // Prevenir que un Super Admin cambie su propio rol a través de esta UI
    if (session.user.id === userIdToUpdate) {
      return NextResponse.json({ message: 'No puedes cambiar tu propio rol de Super Admin a través de esta interfaz.' }, { status: 403 });
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
      const { role: newRole } = updateRoleSchema.parse(body);

      // Prevenir cambiar el rol de un Super Admin a otra cosa a través de esta UI
      const { data: targetProfile, error: fetchProfileError } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userIdToUpdate)
        .single();

      if (fetchProfileError || !targetProfile) {
        console.error(`Error fetching target user profile ${userIdToUpdate}:`, fetchProfileError);
        return NextResponse.json({ message: 'Usuario objetivo no encontrado.' }, { status: 404 });
      }

      if (targetProfile.role === 'super_admin' && newRole !== 'super_admin') {
        return NextResponse.json({ message: 'No puedes cambiar el rol de un Super Admin a través de esta interfaz.' }, { status: 403 });
      }
      
      // El rol de Super Admin solo puede asignarse a través de la configuración inicial (verificación de correo electrónico en el trigger)
      // o directamente en la base de datos. Prevenir la asignación de 'super_admin' a través de esta API.
      if (newRole === 'super_admin') {
          return NextResponse.json({ message: 'El rol de Super Admin no puede ser asignado a través de esta interfaz.' }, { status: 403 });
      }


      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userIdToUpdate)
        .select('id, role')
        .single();

      if (error) {
        console.error(`Error updating role for user ${userIdToUpdate}:`, error);
        await supabaseAdmin.from('server_events_log').insert({
          user_id: session.user.id,
          event_type: 'user_role_update_failed',
          description: `Fallo al actualizar el rol del usuario ${userIdToUpdate} a '${newRole}'. Error: ${error.message}`,
        });
        throw new Error(`Error al actualizar el rol del usuario: ${error.message}`);
      }

      await supabaseAdmin.from('server_events_log').insert({
        user_id: session.user.id,
        event_type: 'user_role_updated',
        description: `Rol del usuario ${userIdToUpdate} actualizado a '${newRole}' por Super Admin '${session.user.email}'.`,
      });

      return NextResponse.json({ message: 'Rol de usuario actualizado correctamente.', user: data }, { status: 200 });

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
      }
      console.error('Unhandled error in PUT /api/users/[id]/role (inner catch):', error);
      return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
    }
  } catch (outerError: any) { // Captura cualquier error que escape del bloque try interno
    console.error('Unhandled error in PUT /api/users/[id]/role (outer catch):', outerError);
    return NextResponse.json({ message: outerError.message || 'Error interno del servidor (inesperado).' }, { status: 500 });
  }
}