export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { SUPERUSER_EMAILS } from '@/lib/constants';

const CRITICAL_EVENT_TYPES = [
  'command_blocked', 'server_add_failed', 'server_delete_failed',
  'container_create_failed', 'container_delete_failed', 'tunnel_create_failed',
  'tunnel_delete_failed', 'npm_install_failed', 'app_recovery_failed',
  'user_create_failed', 'user_delete_failed', 'user_role_update_failed',
  'user_permissions_update_failed',
];

async function getIsSuperAdmin(): Promise<boolean> {
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

  return profile?.role === 'super_admin';
}

export async function GET(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const [
      settingsRes,
      userCountRes,
      serverCountRes,
      containerCountRes,
      tunnelCountRes,
      alertsRes,
      ticketsRes,
      resourcesRes
    ] = await Promise.all([
      supabaseAdmin.from('global_settings').select('*').single(),
      supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('user_servers').select('id', { count: 'exact', head: true }).eq('status', 'ready'),
      supabaseAdmin.from('user_apps').select('id', { count: 'exact', head: true }).eq('status', 'ready'),
      supabaseAdmin.from('docker_tunnels').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('server_events_log').select('id, created_at, event_type, description').in('event_type', CRITICAL_EVENT_TYPES).order('created_at', { ascending: false }).limit(5),
      supabaseAdmin.from('error_tickets').select('id, created_at, user_id, profiles(first_name, last_name)').eq('status', 'new').order('created_at', { ascending: false }).limit(3),
      supabaseAdmin.from('server_resource_logs').select('server_id, cpu_usage, memory_usage_mib').order('created_at', { ascending: false }).limit(200) // Fetch recent logs
    ]);

    // Aggregate resource usage
    const latestLogs = new Map<string, { cpu: number; mem: number }>();
    (resourcesRes.data || []).forEach(log => {
      if (!latestLogs.has(log.server_id)) {
        latestLogs.set(log.server_id, { cpu: log.cpu_usage, mem: log.memory_usage_mib });
      }
    });
    
    let totalCpuUsage = 0;
    let totalMemoryUsageMiB = 0;
    latestLogs.forEach(log => {
      totalCpuUsage += log.cpu;
      totalMemoryUsageMiB += log.mem;
    });
    const avgCpuUsage = latestLogs.size > 0 ? totalCpuUsage / latestLogs.size : 0;

    const dashboardData = {
      systemStatus: settingsRes.data,
      kpis: {
        totalUsers: userCountRes.count,
        activeServers: serverCountRes.count,
        runningContainers: containerCountRes.count,
        activeTunnels: tunnelCountRes.count,
      },
      criticalAlerts: alertsRes.data,
      errorTickets: ticketsRes.data,
      resourceUsage: {
        avgCpuPercent: avgCpuUsage,
        totalMemoryUsedMiB: totalMemoryUsageMiB,
      },
    };

    return NextResponse.json(dashboardData);

  } catch (error: any) {
    console.error('[API /admin/dashboard-stats] Error:', error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}