export const runtime = 'nodejs'; // Force Node.js runtime

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'ssh2';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { DockerContainerStat } from '@/types/docker-stats';
import { SUPERUSER_EMAILS, UserPermissions } from '@/lib/constants'; // Importación actualizada

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

export async function GET(req: NextRequest) {
  const { session, userRole, userPermissions } = await getSessionAndRole();
  if (!session || !userRole) {
    return NextResponse.json({ message: 'Acceso denegado. No autenticado.' }, { status: 401 });
  }
  // Allow Admins and Super Admins to view Docker stats
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

  let query = supabaseAdmin
    .from('user_servers')
    .select('id, name, ip_address, ssh_port, ssh_username, ssh_password')
    .eq('status', 'ready'); // Only fetch from ready servers

  // Both Admins and Super Admins see all servers, so no user_id filter is applied here.

  const { data: servers, error: fetchError } = await query;

  if (fetchError) {
    console.error('Error fetching servers from Supabase (admin):', fetchError);
    return NextResponse.json({ message: 'Error al cargar los servidores.' }, { status: 500 });
  }

  const allContainerStats: DockerContainerStat[] = [];
  const fetchPromises = servers.map(async (server) => {
    const conn = new Client();
    try {
      await new Promise<void>((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect({
        host: server.ip_address,
        port: server.ssh_port || 22,
        username: server.ssh_username,
        password: server.ssh_password,
        readyTimeout: 10000,
      }));

      // 1. Get all containers (running, stopped, exited) using docker ps -a
      const psOutput = await executeSshCommand(conn, `docker ps -a --format "{{json .}}"`);
      const psLines = psOutput.split('\n').filter(Boolean);
      const psContainers = psLines.map(line => JSON.parse(line));

      // 2. Get stats for currently running containers using docker stats
      let statsMap = new Map<string, any>();
      try {
        const statsOutput = await executeSshCommand(conn, `docker stats --no-stream --format "{{json .}}"`);
        const statsLines = statsOutput.split('\n').filter(Boolean);
        statsLines.forEach(line => {
          try {
            const stat = JSON.parse(line);
            statsMap.set(stat.ID, stat);
          } catch (e) {
            console.warn(`[API] Could not parse docker stats line for server ${server.id}: ${line}`);
          }
        });
      } catch (statsErr: any) {
        console.warn(`[API] Could not fetch docker stats for server ${server.id} (might be no running containers): ${statsErr.message}`);
        // It's okay if docker stats fails, it just means no running containers to report stats for.
      }

      conn.end();

      // 3. Combine data
      psContainers.forEach(psContainer => {
        const stat = statsMap.get(psContainer.ID);
        allContainerStats.push({
          ID: psContainer.ID,
          Name: psContainer.Names,
          Image: psContainer.Image,
          'CPU %': stat?.['CPU %'] || '0.00%',
          'Mem Usage': stat?.['Mem Usage'] || '0B / 0B',
          'Mem %': stat?.['Mem %'] || '0.00%',
          'Net I/O': stat?.['Net I/O'] || '0B / 0B',
          'Block I/O': stat?.['Block I/O'] || '0B / 0B',
          PIDs: stat?.PIDs || '0',
          Status: psContainer.Status, // Use the more accurate status from docker ps
          serverId: server.id,
          serverName: server.name || server.ip_address,
          serverIpAddress: server.ip_address,
        });
      });

    } catch (error: any) {
      conn.end();
      console.error(`Error fetching Docker info from server ${server.id} (${server.ip_address}):`, error.message);
      // Optionally, send a toast or log this error to the client
    }
  });

  await Promise.all(fetchPromises);

  return NextResponse.json(allContainerStats, { status: 200 });
}