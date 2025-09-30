export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { SUPERUSER_EMAILS } from '@/lib/constants';

// Define critical event types
const CRITICAL_EVENT_TYPES = [
  'command_blocked',
  'server_add_failed',
  'server_delete_failed',
  'container_create_failed',
  'container_delete_failed',
  'tunnel_create_failed',
  'tunnel_delete_failed',
  'npm_install_failed',
  'app_recovery_failed',
  'user_create_failed',
  'user_delete_failed',
  'user_role_update_failed',
  'user_permissions_update_failed',
];

async function getSessionAndRole(): Promise<{ session: any; userRole: 'user' | 'admin' | 'super_admin' | null }> {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
      },
    }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { session: null, userRole: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  const userRole = profile?.role as 'user' | 'admin' | 'super_admin' | null;
  return { session, userRole };
}

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Function to sanitize command details
function sanitizeCommandDetails(command: string | null): string | null {
  if (!command) return null;
  // Replace sshpass -p 'password' with a generic placeholder
  return command.replace(/sshpass -p '[^']+' ssh/, 'sshpass -p \'[PASSWORD_HIDDEN]\' ssh');
}

export async function GET(req: NextRequest) {
  const { session, userRole } = await getSessionAndRole();
  if (!session || (userRole !== 'admin' && userRole !== 'super_admin')) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  // Fetch all users to create a map of ID to email
  const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
  if (usersError) {
    console.error('[API /alerts] Error fetching users:', usersError);
    return NextResponse.json({ message: 'Error al obtener la lista de usuarios.' }, { status: 500 });
  }
  const userEmailMap = new Map(users.map(u => [u.id, u.email]));

  const { data, error } = await supabaseAdmin
    .from('server_events_log')
    .select(`
      id,
      created_at,
      event_type,
      description,
      command_details,
      server_id,
      user_id,
      user_servers (
        name,
        ip_address
      ),
      profiles:profiles!user_id (
        first_name,
        last_name
      )
    `)
    .in('event_type', CRITICAL_EVENT_TYPES)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[API /alerts] Error fetching critical alerts:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const formattedAlerts = data.map(alert => {
    const profile = (alert.profiles as any);
    let userName = 'Usuario Desconocido';
    if (profile) {
      userName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    }
    if (!userName) {
      userName = userEmailMap.get(alert.user_id) || alert.user_id;
    }

    return {
      id: alert.id,
      created_at: alert.created_at,
      event_type: alert.event_type,
      description: alert.description,
      command_details: sanitizeCommandDetails(alert.command_details),
      server_name: (alert.user_servers as any)?.name || (alert.user_servers as any)?.ip_address || 'N/A',
      user_name: userName,
    };
  });

  return NextResponse.json(formattedAlerts);
}

export async function DELETE(req: NextRequest) {
  const { session, userRole } = await getSessionAndRole();
  if (!session || userRole !== 'super_admin') {
    return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden limpiar el historial de alertas.' }, { status: 403 });
  }

  try {
    // Log the action before clearing the table
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      event_type: 'all_alerts_cleared',
      description: `Todo el historial de alertas críticas fue limpiado por Super Admin '${session.user.email}'.`,
    });

    const { error } = await supabaseAdmin
      .from('server_events_log')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows (using a dummy condition that is always true)

    if (error) {
      console.error('[API /alerts DELETE] Error clearing all critical alerts:', error);
      throw new Error('Error al limpiar todo el historial de alertas críticas.');
    }

    return NextResponse.json({ message: 'Todo el historial de alertas críticas ha sido limpiado correctamente.' });
  } catch (error: any) {
    console.error('[API /alerts DELETE] Unhandled error:', error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}