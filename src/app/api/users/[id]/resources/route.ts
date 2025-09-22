export const runtime = 'nodejs'; // Force Node.js runtime

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { Client } from 'ssh2';
import { parseMemoryString } from '@/lib/utils';

const SUPERUSER_EMAILS = ['martinpensa1@gmail.com'];

async function getSession() {
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
  return supabase.auth.getSession();
}

function executeSshCommand(conn: Client, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let output = '';
      stream.on('data', (data: Buffer) => { output += data.toString(); });
      stream.on('close', (code: number) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`Command exited with code ${code}: ${output.trim()}`));
        }
      });
      stream.stderr.on('data', (data: Buffer) => {
        console.error(`SSH STDERR for command "${command}": ${data.toString().trim()}`);
      });
    });
  });
}

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const userIdToFetch = context.params.id;

  if (!userIdToFetch) {
    return NextResponse.json({ message: 'ID de usuario no proporcionado.' }, { status: 400 });
  }

  const { data: { session } } = await getSession();
  if (!session || !session.user?.email || !SUPERUSER_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
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
    const { data: servers, error: fetchError } = await supabaseAdmin
      .from('user_servers')
      .select('id, name, ip_address, ssh_port, ssh_username, ssh_password')
      .eq('user_id', userIdToFetch)
      .eq('status', 'ready'); // Only fetch resources from ready servers

    if (fetchError) {
      console.error(`Error fetching servers for user ${userIdToFetch}:`, fetchError);
      throw new Error('Error al cargar los servidores del usuario.');
    }

    let totalCpuUsage = 0;
    let totalMemoryUsedMiB = 0;
    let totalMemoryTotalMiB = 0;
    let totalDiskUsagePercent = 0;
    let activeServersCount = 0;
    const serverDetails: any[] = [];

    const resourcePromises = servers.map(async (server) => {
      const conn = new Client();
      try {
        await new Promise<void>((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect({
          host: server.ip_address,
          port: server.ssh_port || 22,
          username: server.ssh_username,
          password: server.ssh_password,
          readyTimeout: 10000,
        }));

        const cpuCommand = `top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk '{print 100 - $1}'`;
        const memCommand = `free -h | grep Mem | awk '{print $3" "$2}'`; // Used Total
        const diskCommand = `df -h / | grep / | awk '{print $5}'`; // Usage %

        const [cpuOutput, memOutput, diskOutput] = await Promise.all([
          executeSshCommand(conn, cpuCommand),
          executeSshCommand(conn, memCommand),
          executeSshCommand(conn, diskCommand),
        ]);

        conn.end();

        const cpu_usage_percent = parseFloat(cpuOutput);
        const [raw_memory_used_str, raw_memory_total_str] = memOutput.split(' ');
        const memory_used_mib = parseMemoryString(raw_memory_used_str || '0B');
        const memory_total_mib = parseMemoryString(raw_memory_total_str || '0B');
        const disk_usage_percent = parseFloat(diskOutput.replace('%', ''));

        if (!isNaN(cpu_usage_percent) && !isNaN(memory_used_mib) && !isNaN(memory_total_mib) && !isNaN(disk_usage_percent)) {
          totalCpuUsage += cpu_usage_percent;
          totalMemoryUsedMiB += memory_used_mib;
          totalMemoryTotalMiB += memory_total_mib;
          totalDiskUsagePercent += disk_usage_percent; // Summing for average later
          activeServersCount++;

          serverDetails.push({
            id: server.id,
            name: server.name || server.ip_address,
            cpu_usage_percent,
            memory_used_mib,
            memory_total_mib,
            disk_usage_percent,
          });
        }

      } catch (serverError: any) {
        conn.end();
        console.warn(`Error fetching resources for server ${server.id} (${server.ip_address}):`, serverError.message);
        // Do not throw, just log and continue with other servers
      }
    });

    await Promise.all(resourcePromises);

    const aggregatedResources = {
      cpu_usage_percent: activeServersCount > 0 ? totalCpuUsage / activeServersCount : 0,
      memory_used_mib: totalMemoryUsedMiB,
      memory_total_mib: totalMemoryTotalMiB,
      disk_usage_percent: activeServersCount > 0 ? totalDiskUsagePercent / activeServersCount : 0,
      timestamp: new Date().toISOString(),
      server_details: serverDetails,
    };

    return NextResponse.json(aggregatedResources, { status: 200 });

  } catch (error: any) {
    console.error(`Unhandled error in GET /api/users/${userIdToFetch}/resources:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}