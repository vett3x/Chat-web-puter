import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'ssh2';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { z } from 'zod';

const SUPERUSER_EMAILS = ['martinpensa1@gmail.com'];

// Zod schema for validation
const createContainerSchema = z.object({
  image: z.string().min(1, { message: 'El nombre de la imagen es requerido.' }),
  name: z.string().optional(),
  ports: z.string().optional(), // e.g., "8080:80"
});

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
        set(name: string, value: string, options: CookieOptions) {},
        remove(name: string, options: CookieOptions) {},
      },
    }
  );
  return supabase.auth.getSession();
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const pathSegments = url.pathname.split('/');
  // Expected path: /api/servers/[id]/docker/containers/create
  const serverId = pathSegments[3];

  if (!serverId) {
    return NextResponse.json({ message: 'ID de servidor no proporcionado en la URL.' }, { status: 400 });
  }

  const { data: { session } } = await getSession();
  if (!session || !session.user?.email || !SUPERUSER_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set.');
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
    .eq('user_id', session.user.id)
    .single();

  if (fetchError || !server) {
    console.error(`Error fetching server ${serverId}:`, fetchError);
    return NextResponse.json({ message: 'Servidor no encontrado o acceso denegado.' }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { image, name, ports } = createContainerSchema.parse(body);

    // Build the docker run command
    let command = 'docker run -d';
    if (name) {
      // Sanitize name to prevent command injection
      command += ` --name ${name.replace(/[^a-zA-Z0-9_.-]/g, '')}`;
    }
    if (ports) {
      // Basic validation for ports format
      if (/^\d{1,5}:\d{1,5}$/.test(ports)) {
        command += ` -p ${ports}`;
      }
    }
    command += ` ${image}`;

    const conn = new Client();
    await new Promise<void>((resolve, reject) => {
      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end();
            return reject(new Error(`SSH exec error: ${err.message}`));
          }
          let stderr = '';
          stream.on('close', (code: number) => {
            conn.end();
            if (code === 0) resolve();
            else reject(new Error(`Docker command exited with code ${code}. Error: ${stderr}`));
          }).stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
            console.error(`STDERR from docker run: ${data.toString()}`);
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

    return NextResponse.json({ message: `Contenedor de la imagen ${image} se está creando.` }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error(`Error creating Docker container on server ${serverId}:`, error.message);
    return NextResponse.json({ message: `Error al crear contenedor Docker: ${error.message}` }, { status: 500 });
  }
}