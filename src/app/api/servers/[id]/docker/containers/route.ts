export const runtime = 'nodejs'; // Force Node.js runtime

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'ssh2';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { DockerContainer } from '@/types/docker';
import { SUPERUSER_EMAILS } from '@/lib/constants'; // Importación actualizada

// Helper function to get the session and user role
async function getSessionAndRole() {
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
  if (session?.user?.id) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();
    if (profile) {
      userRole = profile.role as 'user' | 'admin' | 'super_admin';
    } else if (session.user.email && SUPERUSER_EMAILS.includes(session.user.email)) {
      userRole = 'super_admin'; // Fallback for initial Super Admin
    }
  }
  return { session, userRole };
}

export async function GET(
  req: NextRequest,
  context: any // Simplified type to resolve internal Next.js type conflict
) {
  const serverId = context.params.id;

  if (!serverId) {
    return NextResponse.json({ message: 'ID de servidor no proporcionado en la URL.' }, { status: 400 });
  }

  const { session, userRole } = await getSessionAndRole();
  if (!session || !userRole) {
    return NextResponse.json({ message: 'Acceso denegado. No autenticado.' }, { status: 401 });
  }
  // Allow Admins and Super Admins to view containers
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
    .select('ip_address, ssh_port, ssh_username, ssh_password')
    .eq('id', serverId);

  // Admins can only see their own servers
  if (userRole === 'admin') {
    query = query.eq('user_id', session.user.id);
  }
  // Super Admins can see any server by ID, so no user_id filter for them.

  const { data: server, error: fetchError } = await query.single();

  if (fetchError || !server) {
    console.error(`Error fetching server ${serverId} for user ${session.user.id}:`, fetchError);
    return NextResponse.json({ message: 'Servidor no encontrado o acceso denegado.' }, { status: 404 });
  }

  const conn = new Client();
  let containers: DockerContainer[] = [];

  try {
    await new Promise<void>((resolve, reject) => {
      conn.on('ready', () => {
        conn.exec('docker ps -a --format "{{json .}}"', (err, stream) => {
          if (err) {
            conn.end();
            return reject(new Error(`SSH exec error: ${err.message}`));
          }

          let output = '';
          stream.on('data', (data: Buffer) => {
            output += data.toString();
          }).on('close', (code: number) => {
            conn.end();
            if (code === 0) {
              try {
                containers = output.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
                resolve();
              } catch (parseError) {
                reject(new Error(`Error parsing Docker output: ${parseError}`));
              }
            } else {
              reject(new Error(`Docker command exited with code ${code}`));
            }
          }).stderr.on('data', (data: Buffer) => {
            console.error(`STDERR from docker ps: ${data.toString()}`);
          });
        });
      }).on('error', (err) => {
        reject(new Error(`SSH connection error: ${err.message}`));
      }).connect({
        host: server.ip_address,
        port: server.ssh_port || 22,
        username: server.ssh_username,
        password: server.ssh_password,
        readyTimeout: 10000,
      });
    });

    return NextResponse.json(containers, { status: 200 });
  } catch (error: any) {
    console.error(`Error fetching Docker containers for server ${serverId}:`, error.message);
    return NextResponse.json({ message: `Error al conectar o ejecutar comando Docker: ${error.message}` }, { status: 500 });
  }
}