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

// Helper to execute a command and return its output
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

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const pathSegments = url.pathname.split('/');
  const serverId = pathSegments[3];
  const containerId = pathSegments[6];

  if (!serverId || !containerId) {
    return NextResponse.json({ message: 'ID de servidor o contenedor no proporcionado.' }, { status: 400 });
  }

  const { data: { session } } = await getSession();
  if (!session || !session.user?.email || !SUPERUSER_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: server, error: fetchError } = await supabaseAdmin.from('user_servers').select('ip_address, ssh_port, ssh_username, ssh_password').eq('id', serverId).single();

  if (fetchError || !server) {
    return NextResponse.json({ message: 'Servidor no encontrado.' }, { status: 404 });
  }

  const conn = new Client();
  try {
    await new Promise<void>((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect({ host: server.ip_address, port: server.ssh_port || 22, username: server.ssh_username, password: server.ssh_password, readyTimeout: 10000 }));

    const { stderr: startStderr, code: startCode } = await executeSshCommand(conn, `docker start ${containerId}`);
    if (startCode !== 0) {
      throw new Error(`Error al iniciar contenedor: ${startStderr}`);
    }

    // Poll to verify the container is running
    const startTime = Date.now();
    const timeout = 15000; // 15 seconds
    let isRunning = false;

    while (Date.now() - startTime < timeout) {
      const { stdout: psOutput } = await executeSshCommand(conn, `docker ps --filter "id=${containerId}" --format "{{.Status}}"`);
      if (psOutput.includes('Up')) {
        isRunning = true;
        break;
      }
      await new Promise(res => setTimeout(res, 2000));
    }

    conn.end();

    if (!isRunning) {
      throw new Error('El contenedor no se pudo iniciar a tiempo.');
    }

    return NextResponse.json({ message: `Contenedor ${containerId.substring(0,12)} iniciado.` }, { status: 200 });

  } catch (error: any) {
    conn.end();
    return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 });
  }
}