import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'ssh2';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { z } from 'zod';

const SUPERUSER_EMAILS = ['martinpensa1@gmail.com'];

const createContainerSchema = z.object({
  image: z.string().min(1, { message: 'El nombre de la imagen es requerido.' }),
  name: z.string().optional(),
  ports: z.string().optional(),
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
  const serverId = url.pathname.split('/')[3];

  if (!serverId) {
    return NextResponse.json({ message: 'ID de servidor no proporcionado.' }, { status: 400 });
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
    const body = await req.json();
    const { image, name, ports } = createContainerSchema.parse(body);

    let runCommand = 'docker run -d';
    if (name) runCommand += ` --name ${name.replace(/[^a-zA-Z0-9_.-]/g, '')}`;
    if (ports && /^\d{1,5}:\d{1,5}$/.test(ports)) runCommand += ` -p ${ports}`;
    runCommand += ` --entrypoint tail ${image} -f /dev/null`;

    await new Promise<void>((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect({ host: server.ip_address, port: server.ssh_port || 22, username: server.ssh_username, password: server.ssh_password, readyTimeout: 10000 }));

    const { stdout: newContainerId, stderr: runStderr, code: runCode } = await executeSshCommand(conn, runCommand);
    if (runCode !== 0) {
      throw new Error(`Error al crear contenedor: ${runStderr}`);
    }
    const trimmedId = newContainerId.trim();

    // Poll to verify the container is running
    const startTime = Date.now();
    const timeout = 15000; // 15 seconds
    let isVerified = false;

    while (Date.now() - startTime < timeout) {
      const { stdout: inspectOutput, code: inspectCode } = await executeSshCommand(conn, `docker inspect --format '{{.State.Running}}' ${trimmedId}`);
      if (inspectCode === 0 && inspectOutput.trim() === 'true') {
        isVerified = true;
        break;
      }
      await new Promise(res => setTimeout(res, 2000)); // Wait 2 seconds before next check
    }

    conn.end();

    if (!isVerified) {
      // Don't auto-delete, as it might be a slow-starting container. Let the user decide.
      throw new Error('El contenedor fue creado pero no se pudo verificar su estado "running" a tiempo.');
    }

    return NextResponse.json({ message: `Contenedor ${trimmedId.substring(0,12)} creado y en ejecución.` }, { status: 201 });

  } catch (error: any) {
    conn.end();
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 });
  }
}