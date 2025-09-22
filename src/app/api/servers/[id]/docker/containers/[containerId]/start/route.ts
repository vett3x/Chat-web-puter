export const runtime = 'nodejs'; // Force Node.js runtime

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'ssh2';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
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

function executeSshCommand(conn: Client, command: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      stream.on('data', (data: Buffer) => { stdout += data.toString(); });
      stream.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
      stream.on('close', (code: number) => {
        resolve({ stdout, stderr, code });
      });
    });
  });
}

export async function POST(
  req: NextRequest,
  context: any // Simplified type to resolve internal Next.js type conflict
) {
  const serverId = context.params.id;
  const containerId = context.params.containerId;

  if (!serverId || !containerId) {
    return NextResponse.json({ message: 'ID de servidor o contenedor no proporcionado.' }, { status: 400 });
  }

  const { session, userRole, userPermissions } = await getSessionAndRole();
  if (!session || !userRole) {
    return NextResponse.json({ message: 'Acceso denegado. No autenticado.' }, { status: 401 });
  }
  // Check for granular permission: can_manage_docker_containers
  if (!userPermissions[PERMISSION_KEYS.CAN_MANAGE_DOCKER_CONTAINERS]) {
    return NextResponse.json({ message: 'Acceso denegado. No tienes permiso para iniciar contenedores Docker.' }, { status: 403 });
  }

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: server, error: fetchError } = await supabaseAdmin.from('user_servers').select('ip_address, ssh_port, ssh_username, ssh_password, name').eq('id', serverId).single();

  if (fetchError || !server) {
    // Log event for failed container start (server not found)
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      server_id: serverId,
      event_type: 'container_start_failed',
      description: `Fallo al iniciar contenedor ${containerId.substring(0,12)}: servidor ID ${serverId} no encontrado o acceso denegado.`,
    });
    return NextResponse.json({ message: 'Servidor no encontrado.' }, { status: 404 });
  }

  const conn = new Client();
  try {
    await new Promise<void>((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect({ host: server.ip_address, port: server.ssh_port || 22, username: server.ssh_username, password: server.ssh_password, readyTimeout: 10000 }));

    // The `docker start` command is idempotent. It returns exit code 0
    // if the container is now running or was already running.
    const { stderr, code } = await executeSshCommand(conn, `docker start ${containerId}`);
    conn.end();

    if (code !== 0) {
      // Log event for failed container start
      await supabaseAdmin.from('server_events_log').insert({
        user_id: session.user.id,
        server_id: serverId,
        event_type: 'container_start_failed',
        description: `Fallo al iniciar contenedor ${containerId.substring(0,12)} en '${server.name || server.ip_address}'. Error: ${stderr}`,
      });
      // Any non-zero exit code is an error.
      throw new Error(`Error al iniciar contenedor: ${stderr}`);
    }

    // Log event for successful container start
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      server_id: serverId,
      event_type: 'container_started',
      description: `Contenedor ${containerId.substring(0,12)} iniciado en '${server.name || server.ip_address}'.`,
    });

    return NextResponse.json({ message: `Contenedor ${containerId.substring(0,12)} iniciado.` }, { status: 200 });

  } catch (error: any) {
    conn.end();
    // Log event for general error during container start
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      server_id: serverId,
      event_type: 'container_start_failed',
      description: `Error inesperado al iniciar contenedor ${containerId.substring(0,12)} en '${server.name || server.ip_address}'. Error: ${error.message}`,
    });
    return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 });
  }
}