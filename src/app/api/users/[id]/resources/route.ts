export const runtime = 'nodejs'; // Force Node.js runtime

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { parseMemoryString } from '@/lib/utils';
import { SUPERUSER_EMAILS, UserPermissions, PERMISSION_KEYS } from '@/lib/constants';
import { executeSshCommand } from '@/lib/ssh-utils';

// Helper function to get the session and user role
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
    if (session.user.email && SUPERUSER_EMAILS.includes(session.user.email)) {
      userRole = 'super_admin';
    } else {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      userRole = profile ? profile.role as 'user' | 'admin' | 'super_admin' : 'user';
    }

    if (userRole === 'super_admin') {
      for (const key of Object.values(PERMISSION_KEYS)) {
        userPermissions[key] = true;
      }
    } else {
      const { data: profilePermissions } = await supabase.from('profiles').select('permissions').eq('id', session.user.id).single();
      userPermissions = profilePermissions ? profilePermissions.permissions || {} : {};
    }
  }
  return { session, userRole, userPermissions };
}

export async function GET(
  req: NextRequest,
  context: any
) {
  const userIdToFetch = context.params.id;

  if (!userIdToFetch) {
    return NextResponse.json({ message: 'ID de usuario no proporcionado.' }, { status: 400 });
  }

  const { session, userRole } = await getSessionAndRole();
  if (!session || (userRole !== 'admin' && userRole !== 'super_admin')) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { data: servers, error: fetchError } = await supabaseAdmin
      .from('user_servers')
      .select('id, name, ip_address, ssh_port, ssh_username, ssh_password')
      .eq('user_id', userIdToFetch)
      .eq('status', 'ready');

    if (fetchError) {
      throw new Error(`Error al buscar servidores: ${fetchError.message}`);
    }

    if (!servers || servers.length === 0) {
      return NextResponse.json({
        cpu_usage_percent: 0,
        memory_used_mib: 0,
        memory_total_mib: 0,
        disk_usage_percent: 0,
        timestamp: new Date().toISOString(),
        server_details: [],
      });
    }

    const resourcePromises = servers.map(async (server) => {
      try {
        const cpuCommand = `LC_ALL=C top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk '{print 100 - $1}'`;
        const memCommand = `LC_ALL=C free -m | awk '/^Mem:/{print $3, $2}'`;
        const diskCommand = `LC_ALL=C df -h / | awk 'NR==2{print $5}'`;

        const [cpuOutput, memOutput, diskOutput] = await Promise.all([
          executeSshCommand(server, cpuCommand),
          executeSshCommand(server, memCommand),
          executeSshCommand(server, diskCommand),
        ]);

        const cpu_usage_percent = parseFloat(cpuOutput.stdout);
        const [raw_memory_used_str, raw_memory_total_str] = memOutput.stdout.split(/\s+/);
        const disk_usage_percent = parseFloat(diskOutput.stdout.replace('%', ''));

        return {
          id: server.id,
          name: server.name || server.ip_address,
          cpu_usage_percent: isNaN(cpu_usage_percent) ? 0 : cpu_usage_percent,
          memory_used_mib: parseMemoryString(raw_memory_used_str || '0B'),
          memory_total_mib: parseMemoryString(raw_memory_total_str || '0B'),
          disk_usage_percent: isNaN(disk_usage_percent) ? 0 : disk_usage_percent,
        };
      } catch (error: any) {
        console.error(`Error fetching resources for server ${server.id}:`, error.message);
        return null; // Return null for failed servers
      }
    });

    const serverDetails = (await Promise.all(resourcePromises)).filter(Boolean) as any[];

    let totalCpu = 0;
    let totalMemUsed = 0;
    let totalMemTotal = 0;
    let totalDisk = 0;

    serverDetails.forEach(detail => {
      totalCpu += detail.cpu_usage_percent;
      totalMemUsed += detail.memory_used_mib;
      totalMemTotal += detail.memory_total_mib;
      totalDisk += detail.disk_usage_percent;
    });

    const avgCpu = serverDetails.length > 0 ? totalCpu / serverDetails.length : 0;
    const avgDisk = serverDetails.length > 0 ? totalDisk / serverDetails.length : 0;

    return NextResponse.json({
      cpu_usage_percent: avgCpu,
      memory_used_mib: totalMemUsed,
      memory_total_mib: totalMemTotal,
      disk_usage_percent: avgDisk,
      timestamp: new Date().toISOString(),
      server_details: serverDetails,
    });

  } catch (error: any) {
    console.error(`[API /users/${userIdToFetch}/resources] Error:`, error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}