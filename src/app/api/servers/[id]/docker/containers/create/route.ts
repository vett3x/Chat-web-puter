export const runtime = 'nodejs'; // Force Node.js runtime

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'ssh2';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { SUPERUSER_EMAILS, UserPermissions, PERMISSION_KEYS } from '@/lib/constants'; // Importación actualizada

const createContainerSchema = z.object({
  image: z.string().min(1, { message: 'El nombre de la imagen es requerido.' }),
  name: z.string().optional(),
  ports: z.string().optional(),
});

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
    // First, determine the role, prioritizing SUPERUSER_EMAILS
    if (session.user.email && SUPERUSER_EMAILS.includes(session.user.email)) {
      userRole = 'super_admin';
    } else {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role') // Only need role for initial determination
        .eq('id', session.user.id)
        .single();
      if (profile) {
        userRole = profile.role as 'user' | 'admin' | 'super_admin';
      } else {
        userRole = 'user'; // Default to user if no profile found and not superuser email
      }
    }

    // Then, fetch permissions from profile, or set all if super_admin
    if (userRole === 'super_admin') {
      for (const key of Object.values(PERMISSION_KEYS)) {
        userPermissions[key] = true;
      }
    } else {
      const { data: profilePermissions, error: permissionsError } = await supabase
        .from('profiles')
        .select('permissions')
        .eq('id', session.user.id)
        .single();
      if (profilePermissions) {
        userPermissions = profilePermissions.permissions || {};
      } else {
        // Default permissions for non-super-admin if profile fetch failed
        userPermissions = {
          [PERMISSION_KEYS.CAN_CREATE_SERVER]: false,
          [PERMISSION_KEYS.CAN_MANAGE_DOCKER_CONTAINERS]: false,
          [PERMISSION_KEYS.CAN_MANAGE_CLOUDFLARE_DOMAINS]: false,
          [PERMISSION_KEYS.CAN_MANAGE_CLOUDFLARE_TUNNELS]: false,
        };
      }
    }
  }
  return { session, userRole, userPermissions };
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

export async function POST(
  req: NextRequest,
  context: any // Simplified type to resolve internal Next.js type conflict
) {
  const serverId = context.params.id;

  if (!serverId) {
    return NextResponse.json({ message: 'ID de servidor no proporcionado.' }, { status: 400 });
  }

  const { session, userRole, userPermissions } = await getSessionAndRole();
  if (!session || !userRole) {
    return NextResponse.json({ message: 'Acceso denegado. No autenticado.' }, { status: 401 });
  }
  // Check for granular permission: can_manage_docker_containers
  if (!userPermissions[PERMISSION_KEYS.CAN_MANAGE_DOCKER_CONTAINERS]) {
    return NextResponse.json({ message: 'Acceso denegado. No tienes permiso para crear contenedores Docker.' }, { status: 403 });
  }

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: server, error: fetchError } = await supabaseAdmin.from('user_servers').select('ip_address, ssh_port, ssh_username, ssh_password, name').eq('id', serverId).single();

  if (fetchError || !server) {
    // Log event for failed container creation (server not found)
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      server_id: serverId,
      event_type: 'container_create_failed',
      description: `Fallo al crear contenedor en servidor ID ${serverId}: servidor no encontrado o acceso denegado.`,
    });
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
      // Log event for container created but not verified
      await supabaseAdmin.from('server_events_log').insert({
        user_id: session.user.id,
        server_id: serverId,
        event_type: 'container_create_warning',
        description: `Contenedor '${name || image}' (ID: ${trimmedId.substring(0,12)}) creado en '${server.name || server.ip_address}', pero no se pudo verificar su estado de ejecución.`,
      });
      throw new Error('El contenedor fue creado pero no se pudo verificar su estado "running" a tiempo.');
    }

    // Log event for successful container creation
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      server_id: serverId,
      event_type: 'container_created',
      description: `Contenedor '${name || image}' (ID: ${trimmedId.substring(0,12)}) creado y en ejecución en '${server.name || server.ip_address}'.`,
    });

    return NextResponse.json({ message: `Contenedor ${trimmedId.substring(0,12)} creado y en ejecución.` }, { status: 201 });

  } catch (error: any) {
    conn.end();
    if (error instanceof z.ZodError) {
      // Log event for validation error
      await supabaseAdmin.from('server_events_log').insert({
        user_id: session.user.id,
        server_id: serverId,
        event_type: 'container_create_failed',
        description: `Fallo de validación al crear contenedor en '${server.name || server.ip_address}'. Error: ${error.message}`,
      });
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    // Log event for general error during container creation
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      server_id: serverId,
      event_type: 'container_create_failed',
      description: `Error al crear contenedor en '${server.name || server.ip_address}'. Error: ${error.message}`,
    });
    return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 });
  }
}