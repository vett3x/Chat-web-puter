export const runtime = 'nodejs'; // Force Node.js runtime

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { SUPERUSER_EMAILS, UserPermissions, PERMISSION_KEYS } from '@/lib/constants'; // Importación actualizada

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

// Define una interfaz para el resultado de la consulta de Supabase
interface SupabaseUserProfileWithAuth {
  first_name: string | null;
  last_name: string | null;
  auth_users: { email: string | null } | null;
  role: 'user' | 'admin' | 'super_admin'; // Added role
}

export async function DELETE(
  req: NextRequest,
  context: any // Simplified type to resolve internal Next.js type conflict
) {
  const userIdToDelete = context.params.id;

  if (!userIdToDelete) {
    return NextResponse.json({ message: 'ID de usuario no proporcionado.' }, { status: 400 });
  }

  const { session, userRole } = await getSessionAndRole(); // <-- Corrección aquí: desestructuración directa de 'session'
  // Only Super Admins can delete users
  if (!session || userRole !== 'super_admin') {
    return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden eliminar usuarios.' }, { status: 403 });
  }

  // Prevent SuperUser from deleting themselves
  if (session.user.id === userIdToDelete) {
    return NextResponse.json({ message: 'No puedes eliminar tu propia cuenta de Super Admin.' }, { status: 403 });
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
    // First, get user details for logging and to check if target is Super Admin
    const { data: userProfile, error: fetchProfileError } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name, role, auth_users:auth.users(email)')
      .eq('id', userIdToDelete)
      .single() as { data: SupabaseUserProfileWithAuth | null, error: any }; // Castear el resultado

    const userEmail = userProfile?.auth_users?.email || 'N/A';
    const userName = userProfile?.first_name && userProfile?.last_name 
      ? `${userProfile.first_name} ${userProfile.last_name}` 
      : userEmail;

    if (fetchProfileError || !userProfile) {
      console.error(`Error fetching profile for user ${userIdToDelete}:`, fetchProfileError);
      await supabaseAdmin.from('server_events_log').insert({
        user_id: session.user.id,
        event_type: 'user_delete_failed',
        description: `Fallo al eliminar usuario con ID ${userIdToDelete}: no encontrado o acceso denegado.`,
      });
      return NextResponse.json({ message: 'Usuario no encontrado o acceso denegado.' }, { status: 404 });
    }

    // Prevent Super Admin from deleting another Super Admin
    if (userProfile.role === 'super_admin') {
      return NextResponse.json({ message: 'No puedes eliminar a otro Super Admin.' }, { status: 403 });
    }

    // Delete the user from auth.users. This should cascade to public.profiles
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userIdToDelete);

    if (deleteUserError) {
      console.error(`Error deleting user ${userIdToDelete}:`, deleteUserError);
      await supabaseAdmin.from('server_events_log').insert({
        user_id: session.user.id,
        event_type: 'user_delete_failed',
        description: `Fallo al eliminar usuario '${userName}' (ID: ${userIdToDelete}). Error: ${deleteUserError.message}`,
      });
      throw new Error(`Error al eliminar el usuario: ${deleteUserError.message}`);
    }

    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      event_type: 'user_deleted',
      description: `Usuario '${userName}' (ID: ${userIdToDelete}) eliminado por Super Admin '${session.user.email}'.`,
    });

    return NextResponse.json({ message: `Usuario '${userName}' eliminado correctamente.` }, { status: 200 });

  } catch (error: any) {
    console.error('Error in DELETE /api/users/[id]:', error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}