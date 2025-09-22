export const runtime = 'nodejs'; // Force Node.js runtime

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'ssh2';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { SUPERUSER_EMAILS, UserPermissions, PERMISSION_KEYS } from '@/lib/constants'; // Importación actualizada
import { createAndProvisionCloudflareTunnel } from '@/lib/tunnel-orchestration'; // Import the new server action

const createContainerSchema = z.object({
  image: z.string().min(1, { message: 'El nombre de la imagen es requerido.' }),
  name: z.string().optional(),
  // Removed 'ports' field as it's not needed for Next.js template
  // Removed 'framework' field as Next.js is the only template
  cloudflare_domain_id: z.string().uuid({ message: 'ID de dominio de Cloudflare inválido.' }).optional(),
  container_port: z.coerce.number().int().min(1).max(65535, { message: 'Puerto de contenedor inválido.' }).optional(),
  subdomain: z.string().regex(/^[a-z0-9-]{1,63}$/, { message: 'Subdominio inválido. Solo minúsculas, números y guiones.' }).optional(),
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

  let containerId: string | undefined;

  try {
    const body = await req.json();
    const { image, name, cloudflare_domain_id, container_port, subdomain } = createContainerSchema.parse(body);

    let runCommand = 'docker run -d';
    const baseImage = 'ubuntu:latest'; // Changed to ubuntu:latest
    const entrypointExecutable = 'tail';
    const entrypointArgs = '-f /dev/null';

    // --- Phase 1: Handle image check/pull for Next.js framework (always) ---
    const imageConn = new Client();
    try {
      await new Promise<void>((resolve, reject) => imageConn.on('ready', resolve).on('error', reject).connect({ host: server.ip_address, port: server.ssh_port || 22, username: server.ssh_username, password: server.ssh_password, readyTimeout: 10000 }));
      
      const { code: inspectCode } = await executeSshCommand(imageConn, `docker inspect --type=image ${baseImage}`);
      if (inspectCode !== 0) {
        await supabaseAdmin.from('server_events_log').insert({
          user_id: session.user.id,
          server_id: serverId,
          event_type: 'container_create_warning',
          description: `Imagen '${baseImage}' no encontrada en '${server.name || server.ip_address}'. Intentando descargar...`,
        });
        const { stderr: pullStderr, code: pullCode } = await executeSshCommand(imageConn, `docker pull ${baseImage}`);
        if (pullCode !== 0) {
          throw new Error(`Error al descargar la imagen '${baseImage}': ${pullStderr}`);
        }
        await supabaseAdmin.from('server_events_log').insert({
          user_id: session.user.id,
          server_id: serverId,
          event_type: 'container_created', // Log as created for image pull success
          description: `Imagen '${baseImage}' descargada exitosamente en '${server.name || server.ip_address}'.`,
        });
      }
    } finally {
      imageConn.end();
    }

    // --- Phase 2: Create and run the Docker container ---
    const runConn = new Client();
    try {
      await new Promise<void>((resolve, reject) => runConn.on('ready', resolve).on('error', reject).connect({ host: server.ip_address, port: server.ssh_port || 22, username: server.ssh_username, password: server.ssh_password, readyTimeout: 10000 }));

      if (name) runCommand += ` --name ${name.replace(/[^a-zA-Z0-9_.-]/g, '')}`;
      const finalPorts = container_port ? `${container_port}:${container_port}` : '3000:3000';
      runCommand += ` -p ${finalPorts}`;
      
      runCommand += ` --entrypoint ${entrypointExecutable} ${baseImage} ${entrypointArgs}`;

      const { stdout: newContainerId, stderr: runStderr, code: runCode } = await executeSshCommand(runConn, runCommand);
      if (runCode !== 0) {
        throw new Error(`Error al crear contenedor: ${runStderr}`);
      }
      containerId = newContainerId.trim();

      // Poll to verify the container is running
      const startTime = Date.now();
      const timeout = 15000;
      let isVerified = false;

      while (Date.now() - startTime < timeout) {
        const { stdout: inspectOutput, code: inspectCode } = await executeSshCommand(runConn, `docker inspect --format '{{.State.Running}}' ${containerId}`);
        if (inspectCode === 0 && inspectOutput.trim() === 'true') {
          isVerified = true;
          break;
        }
        await new Promise(res => setTimeout(res, 2000));
      }

      if (!isVerified) {
        await supabaseAdmin.from('server_events_log').insert({
          user_id: session.user.id,
          server_id: serverId,
          event_type: 'container_create_warning',
          description: `Contenedor '${name || image}' (ID: ${containerId?.substring(0,12)}) creado en '${server.name || server.ip_address}', pero no se pudo verificar su estado de ejecución.`,
        });
        throw new Error('El contenedor fue creado pero no se pudo verificar su estado "running" a tiempo.');
      }

      await supabaseAdmin.from('server_events_log').insert({
        user_id: session.user.id,
        server_id: serverId,
        event_type: 'container_created',
        description: `Contenedor '${name || image}' (ID: ${containerId?.substring(0,12)}) creado y en ejecución en '${server.name || server.ip_address}'.`,
      });

      // --- NUEVO: Instalar Node.js y npm dentro del contenedor ---
      await supabaseAdmin.from('server_events_log').insert({
        user_id: session.user.id,
        server_id: serverId,
        event_type: 'container_created',
        description: `Instalando Node.js y npm en el contenedor ${containerId?.substring(0,12)}...`,
      });

      // Reescrito el script para ser más robusto y evitar errores de sintaxis con sh -c
      const installNodeScript = `
        set -e && \\
        export DEBIAN_FRONTEND=noninteractive && \\
        apt-get update -y && \\
        apt-get install -y curl && \\
        curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - && \\
        apt-get install -y nodejs && \\
        node -v && \\
        npm -v
      `.replace(/\\(?=\n)/g, '').replace(/\n/g, ' ').trim(); // Eliminar saltos de línea y backslashes de continuación

      const { stderr: nodeInstallStderr, code: nodeInstallCode } = await executeSshCommand(runConn, `docker exec ${containerId} sh -c "${installNodeScript}"`);
      if (nodeInstallCode !== 0) {
        throw new Error(`Error al instalar Node.js/npm en el contenedor: ${nodeInstallStderr}`);
      }
      await supabaseAdmin.from('server_events_log').insert({
        user_id: session.user.id,
        server_id: serverId,
        event_type: 'container_created',
        description: `Node.js y npm instalados en el contenedor ${containerId?.substring(0,12)}.`,
      });
      // --- FIN NUEVO ---

    } finally {
      runConn.end();
    }

    // Tunnel creation logic (always for Next.js)
    if (cloudflare_domain_id && container_port && userPermissions[PERMISSION_KEYS.CAN_MANAGE_CLOUDFLARE_TUNNELS]) {
      // Fetch Cloudflare domain details
      const { data: cfDomainDetails, error: cfDomainError } = await supabaseAdmin
        .from('cloudflare_domains')
        .select('domain_name, api_token, zone_id, account_id')
        .eq('id', cloudflare_domain_id)
        .eq('user_id', session.user.id)
        .single();

      if (cfDomainDetails && !cfDomainError) {
        createAndProvisionCloudflareTunnel({
          userId: session.user.id,
          serverId: serverId,
          containerId: containerId!, // containerId is guaranteed to be defined here if we reach this point without error
          cloudflareDomainId: cloudflare_domain_id,
          containerPort: container_port,
          subdomain: subdomain,
          serverDetails: {
            ip_address: server.ip_address,
            ssh_port: server.ssh_port || 22,
            ssh_username: server.ssh_username,
            ssh_password: server.ssh_password,
            name: server.name,
          },
          cloudflareDomainDetails: cfDomainDetails,
        }).catch(tunnelError => {
          console.error(`Error during automated tunnel creation for container ${containerId}:`, tunnelError);
          supabaseAdmin.from('server_events_log').insert({
            user_id: session.user.id,
            server_id: serverId,
            event_type: 'tunnel_create_failed',
            description: `Fallo en la creación automática del túnel para el contenedor ${containerId?.substring(0,12)}. Error: ${tunnelError.message}`,
          }).then();
        });
      } else {
        console.warn(`[Container Create] Tunnel details provided for Next.js container ${containerId}, but Cloudflare domain details could not be fetched or user lacks permissions. Tunnel not created automatically.`);
        supabaseAdmin.from('server_events_log').insert({
          user_id: session.user.id,
          server_id: serverId,
          event_type: 'tunnel_create_warning',
          description: `Advertencia: No se pudo crear el túnel automáticamente para el contenedor ${containerId?.substring(0,12)}. Detalles de dominio de Cloudflare no encontrados o permisos insuficientes.`,
        }).then();
      }
    }

    // Add guidance for Next.js setup (always)
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      server_id: serverId,
      event_type: 'container_created',
      description: `Contenedor Next.js (ID: ${containerId?.substring(0,12)}) creado. Node.js y npm preinstalados. Pasos siguientes:
      1. Conéctate al servidor SSH: ssh ${server.ssh_username}@${server.ip_address} -p ${server.ssh_port || 22}
      2. Accede al contenedor: docker exec -it ${containerId?.substring(0,12)} /bin/bash
      3. Dentro del contenedor, crea tu app Next.js: npx create-next-app@latest my-next-app --use-npm --example "https://github.com/vercel/next.js/tree/canary/examples/hello-world"
      4. Navega a tu app: cd my-next-app
      5. Inicia el servidor de desarrollo: npm run dev -- -p ${container_port || 3000}
      6. Si configuraste un túnel Cloudflare, tu app estará accesible en el dominio.`,
    });

    return NextResponse.json({ message: `Contenedor ${containerId?.substring(0,12)} creado y en ejecución.` }, { status: 201 });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      await supabaseAdmin.from('server_events_log').insert({
        user_id: session.user.id,
        server_id: serverId,
        event_type: 'container_create_failed',
        description: `Fallo de validación al crear contenedor en '${server.name || server.ip_address}'. Error: ${error.message}`,
      });
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      server_id: serverId,
      event_type: 'container_create_failed',
      description: `Error al crear contenedor en '${server.name || server.ip_address}'. Error: ${error.message}`,
    });
    return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 });
  }
}