export const runtime = 'nodejs'; // Force Node.js runtime

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'ssh2';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';

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
        // Log stderr but don't necessarily reject unless it's the only output
        console.error(`SSH STDERR for command "${command}": ${data.toString().trim()}`);
      });
    });
  });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const pathSegments = url.pathname.split('/');
  const serverId = pathSegments[3];

  if (!serverId) {
    return NextResponse.json({ message: 'ID de servidor no proporcionado.' }, { status: 400 });
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

  const { data: server, error: fetchError } = await supabaseAdmin
    .from('user_servers')
    .select('ip_address, ssh_port, ssh_username, ssh_password')
    .eq('id', serverId)
    .eq('user_id', session.user.id)
    .single();

  if (fetchError || !server) {
    console.error(`Error fetching server ${serverId} for user ${session.user.id}:`, fetchError);
    return NextResponse.json({ message: 'Servidor no encontrado o acceso denegado.' }, { status: 404 });
  }

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
    const [memory_used, memory_total] = memOutput.split(' ');
    const disk_usage_percent = parseFloat(diskOutput.replace('%', ''));

    return NextResponse.json({
      cpu_usage_percent: isNaN(cpu_usage_percent) ? 0 : cpu_usage_percent,
      memory_used: memory_used || 'N/A',
      memory_total: memory_total || 'N/A',
      disk_usage_percent: isNaN(disk_usage_percent) ? 0 : disk_usage_percent,
      timestamp: new Date().toISOString(),
    }, { status: 200 });

  } catch (error: any) {
    conn.end();
    console.error(`Error fetching server resources for server ${serverId}:`, error.message);
    return NextResponse.json({ message: `Error al obtener recursos del servidor: ${error.message}` }, { status: 500 });
  }
}