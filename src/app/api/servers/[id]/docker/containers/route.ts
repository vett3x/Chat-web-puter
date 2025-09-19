import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'ssh2';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { DockerContainer } from '@/types/docker';

// Define SuperUser emails (for server-side check)
const SUPERUSER_EMAILS = ['martinpensa1@gmail.com'];

// Helper function to get the session
async function getSession() {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // In a Route Handler, the cookie store is read-only.
        },
        remove(name: string, options: CookieOptions) {
          // In a Route Handler, the cookie store is read-only.
        },
      },
    }
  );
  return supabase.auth.getSession();
}

export async function GET(
  req: NextRequest,
  context: { params: { id: string } } // Make context required
) {
  const serverId = context.params.id;

  const { data: { session } } = await getSession();
  if (!session || !session.user?.email || !SUPERUSER_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables.');
    return NextResponse.json({ message: 'Error de configuración del servidor: Clave de servicio de Supabase no encontrada.' }, { status: 500 });
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
                containers = output.trim().split('\n').map(line => JSON.parse(line));
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
        readyTimeout: 10000, // 10 seconds timeout
      });
    });

    return NextResponse.json(containers, { status: 200 });
  } catch (error: any) {
    console.error(`Error fetching Docker containers for server ${serverId}:`, error.message);
    return NextResponse.json({ message: `Error al conectar o ejecutar comando Docker: ${error.message}` }, { status: 500 });
  }
}