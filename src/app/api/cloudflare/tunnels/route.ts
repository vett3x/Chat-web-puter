export const runtime = 'nodejs'; // Force Node.js runtime

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { SUPERUSER_EMAILS, UserPermissions, PERMISSION_KEYS } from '@/lib/constants'; // Importación actualizada
import { executeSshCommand } from '@/lib/ssh-utils'; // Import SSH utilities

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

export async function GET(req: NextRequest) {
  const { session, userRole } = await getSessionAndRole();
  if (!session || !userRole) {
    return NextResponse.json({ message: 'Acceso denegado. No autenticado.' }, { status: 401 });
  }
  // Allow Admins and Super Admins to view Cloudflare tunnels
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return NextResponse.json({ message: 'Acceso denegado. Se requiere rol de Admin o Super Admin.' }, { status: 403 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set.');
    return NextResponse.json({ message: 'Error de configuración del servidor.' }, { status: 500 });
  }

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  try {
    let query = supabaseAdmin
      .from('docker_tunnels')
      .select(`
        id,
        server_id,
        container_id,
        full_domain,
        container_port,
        status,
        created_at,
        cloudflare_domains (
          domain_name
        ),
        user_servers (
          name,
          ip_address
        )
      `);

    // Both Admins and Super Admins see all tunnels, so no user_id filter is applied here.

    const { data: tunnels, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching Docker tunnels:', error);
      throw new Error('Error al cargar los túneles Docker.');
    }

    const formattedTunnels = tunnels.map(tunnel => ({
      id: tunnel.id,
      server_id: tunnel.server_id,
      container_id: tunnel.container_id,
      full_domain: tunnel.full_domain,
      container_port: tunnel.container_port,
      status: tunnel.status,
      created_at: tunnel.created_at,
      domain_name: (tunnel.cloudflare_domains as any)?.domain_name || 'N/A',
      server_name: (tunnel.user_servers as any)?.name || (tunnel.user_servers as any)?.ip_address || 'N/A',
    }));

    return NextResponse.json(formattedTunnels, { status: 200 });

  } catch (error: any) {
    console.error('Error in GET /api/cloudflare/tunnels:', error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}