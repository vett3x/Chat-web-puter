export const runtime = 'nodejs'; // Force Node.js runtime

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'ssh2';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { z } from 'zod';

const SUPERUSER_EMAILS = ['martinpensa1@gmail.com'];

const execSchema = z.object({
  command: z.string(),
});

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

export async function POST(
  req: NextRequest,
  context: any // Simplified type to resolve internal Next.js type conflict
) {
  const serverId = context.params.id;
  const containerId = context.params.containerId;

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

  try {
    const body = await req.json();
    const { command } = execSchema.parse(body);

    if (!command || typeof command !== 'string') {
      return NextResponse.json({ message: 'Comando inválido.' }, { status: 400 });
    }

    const conn = new Client();
    const output = await new Promise<string>((resolve, reject) => {
      conn.on('ready', () => {
        conn.exec(`docker exec ${containerId} sh -c "${command}"`, (err, stream) => {
          if (err) {
            conn.end();
            return reject(new Error(`SSH exec error: ${err.message}`));
          }
          let result = '';
          stream.on('data', (data: Buffer) => {
            result += data.toString();
          }).stderr.on('data', (data: Buffer) => {
            result += data.toString();
          }).on('close', () => {
            conn.end();
            resolve(result);
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

    return NextResponse.json({ output }, { status: 200 });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error(`Error executing command on container ${containerId}:`, error);
    return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 });
  }
}