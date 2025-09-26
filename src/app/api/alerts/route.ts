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

async function getIsAdmin(): Promise<boolean> {
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
  if (!session) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  return profile?.role === 'admin' || profile?.role === 'super_admin';
}

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Function to sanitize command details
function sanitizeCommandDetails(command: string | null): string | null {
  if (!command) return null;
  // Replace sshpass -p 'password' with a generic placeholder
  return command.replace(/sshpass -p '[^']+' ssh/, 'sshpass -p \'[PASSWORD_HIDDEN]\' ssh');
}

export async function GET(req: NextRequest) {
  const isAdmin = await getIsAdmin();
  if (!isAdmin) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('server_events_log')
    .select(`
      id,
      created_at,
      event_type,
      description,
      command_details,
      server_id,
      user_servers (
        name,
        ip_address
      )
    `)
    .in('event_type', CRITICAL_EVENT_TYPES)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[API /alerts] Error fetching critical alerts:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const formattedAlerts = data.map(alert => ({
    ...alert,
    server_name: (alert.user_servers as any)?.name || (alert.user_servers as any)?.ip_address || 'N/A',
    command_details: sanitizeCommandDetails(alert.command_details), // Apply sanitization here
  }));

  return NextResponse.json(formattedAlerts);
}