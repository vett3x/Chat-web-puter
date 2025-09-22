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
    return NextResponse.json({ message: 'Acceso denegado. No tienes permiso para detener contenedores Docker.' }, { status: 403 });
  }

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: server, error: fetchError } = await supabaseAdmin.from('user_servers').select('ip_address, ssh_port, ssh_username, ssh_password, name').eq('id', serverId).single();

  if (fetchError || !server) {
    // Log event for failed container stop (server not found)
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      server_id: serverId,
      event_type: 'container_stop_failed',
      description: `Fallo al detener contenedor ${containerId.substring(0,12)}: servidor ID ${serverId} no encontrado o acceso denegado.`,
    });
    return NextResponse.json({ message: 'Servidor no encontrado.' }, { status: 404 });
  }

  const conn = new Client();
  try {
    await new Promise<void>((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect({ host: server.ip_address, port: server.ssh_port || 22, username: server.ssh_username, password: server.ssh_password, readyTimeout: 10000 }));

    // The `docker stop` command waits for the container to stop.
    // It returns exit code 0 if the container was running and is now stopped,
    // or if it was already stopped.
    const { stderr, code } = await executeSshCommand(conn, `docker stop ${containerId}`);
    conn.end();

    if (code !== 0) {
      if (stderr.includes('No such container')) {
        // Log event for container already stopped/not found
        await supabaseAdmin.from('server_events_log').insert({
          user_id: session.user.id,
          server_id: serverId,
          event_type: 'container_stopped',
          description: `Contenedor ${containerId.substring(0,12)} ya estaba detenido o no existe en '${server.name || server.ip_address}'.`,
        });
        // If it doesn't exist, it's effectively "stopped".
        return NextResponse.json({ message: `Contenedor ${containerId.substring(0,12)} no encontrado, se considera detenido.` }, { status: 200 });
      }
      // Log event for failed container stop
      await supabaseAdmin.from('server_events_log').insert({
        user_id: session.user.id,
        server_id: serverId,
        event_type: 'container_stop_failed',
        description: `Fallo al detener contenedor ${containerId.substring(0,12)} en '${server.name || server.ip_address}'. Error: ${stderr}`,
      });
      // Any other error is a failure.
      throw new Error(`Error al detener contenedor: ${stderr}`);
    }

    // Log event for successful container stop
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      server_id: serverId,
      event_type: 'container_stopped',
      description: `Contenedor ${containerId.substring(0,12)} detenido en '${server.name || server.ip_address}'.`,
    });

    return NextResponse.json({ message: `Contenedor ${containerId.substring(0,12)} detenido.` }, { status: 200 });

  } catch (error: any) {
    conn.end();
    // Log event for general error during container stop
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      server_id: serverId,
      event_type: 'container_stop_failed',
      description: `Error inesperado al detener contenedor ${containerId.substring(0,12)} en '${server.name || server.ip_address}'. Error: ${error.message}`,
    });
    return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 });
  }
}