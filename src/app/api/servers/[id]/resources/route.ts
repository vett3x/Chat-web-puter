export const runtime = 'nodejs'; // Force Node.js runtime

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'ssh2';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { parseMemoryString } from '@/lib/utils'; // Import the utility function
import { SUPERUSER_EMAILS, UserPermissions, PERMISSION_KEYS } from '@/lib/constants'; // Importación actualizada

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

export async function GET(
  req: NextRequest,
  context: any // Usamos 'any' para resolver el error de compilación de TypeScript
) {
  const serverId = context.params.id;

  if (!serverId) {
    return NextResponse.json({ message: 'ID de servidor no proporcionado.' }, { status: 400 });
  }

  const { session, userRole } = await getSessionAndRole();
  if (!session || !userRole) {
    return NextResponse.json({ message: 'Acceso denegado. No autenticado.' }, { status: 401 });
  }
  // Allow Admins and Super Admins to view resources
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return NextResponse.json({ message: 'Acceso denegado. Se requiere rol de Admin o Super Admin.' }, { status: 403 });
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
    // .eq('user_id', session.user.id) // <-- REMOVED THIS LINE
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
    const memCommand = `free -m | grep Mem | awk '{print $3" "$2}'`; // Used Total in MiB
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

    return NextResponse.json({
      cpu_usage_percent: isNaN(cpu_usage_percent) ? 0 : cpu_usage_percent,
      memory_used: raw_memory_used_str || 'N/A', // Keep raw string for display
      memory_total: raw_memory_total_str || 'N/A', // Keep raw string for display
      memory_used_mib: memory_used_mib, // New numeric field
      memory_total_mib: memory_total_mib, // New numeric field
      disk_usage_percent: isNaN(disk_usage_percent) ? 0 : disk_usage_percent,
      timestamp: new Date().toISOString(),
    }, { status: 200 });

  } catch (error: any) {
    conn.end();
    console.error(`Error fetching server resources for server ${serverId}:`, error.message);
    return NextResponse.json({ message: `Error al obtener recursos del servidor: ${error.message}` }, { status: 500 });
  }
}