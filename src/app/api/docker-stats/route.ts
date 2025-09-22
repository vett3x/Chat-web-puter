export const runtime = 'nodejs'; // Force Node.js runtime

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'ssh2';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { DockerContainerStat } from '@/types/docker-stats';

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

export async function GET(req: NextRequest) {
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

  const { data: servers, error: fetchError } = await supabaseAdmin
    .from('user_servers')
    .select('id, name, ip_address, ssh_port, ssh_username, ssh_password')
    .eq('user_id', session.user.id)
    .eq('status', 'ready'); // Only fetch from ready servers

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

      // Get stats for all running containers
      const statsOutput = await executeSshCommand(conn, `docker stats --no-stream --format "{{json .}}"`);
      const containersOutput = await executeSshCommand(conn, `docker ps -a --format "{{json .}}`); // To get Image name and Status

      conn.end();

      const statsLines = statsOutput.split('\n').filter(Boolean);
      const psLines = containersOutput.split('\n').filter(Boolean);

      const psMap = new Map<string, any>();
      psLines.forEach(line => {
        try {
          const containerInfo = JSON.parse(line);
          psMap.set(containerInfo.ID, containerInfo);
        } catch (e) {
          console.warn(`[API] Could not parse docker ps line for server ${server.id}: ${line}`);
        }
      });

      statsLines.forEach(line => {
        try {
          const stat: DockerContainerStat = JSON.parse(line);
          const containerInfo = psMap.get(stat.ID);
          allContainerStats.push({
            ...stat,
            Image: containerInfo?.Image || 'N/A', // Add Image from docker ps
            Status: containerInfo?.Status || 'N/A', // Add Status from docker ps
            serverId: server.id,
            serverName: server.name || server.ip_address,
            serverIpAddress: server.ip_address,
          });
        } catch (e) {
          console.warn(`[API] Could not parse docker stats line for server ${server.id}: ${line}`);
        }
      });

    } catch (error: any) {
      conn.end();
      console.error(`Error fetching Docker stats from server ${server.id} (${server.ip_address}):`, error.message);
      // Optionally, send a toast or log this error to the client
    }
  });

  await Promise.all(fetchPromises);

  return NextResponse.json(allContainerStats, { status: 200 });
}