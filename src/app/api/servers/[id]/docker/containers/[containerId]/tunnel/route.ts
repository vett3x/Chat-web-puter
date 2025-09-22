export const runtime = 'nodejs'; // Force Node.js runtime

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  generateRandomSubdomain,
  createCloudflareTunnel,
  deleteCloudflareTunnel,
  createCloudflareDnsRecord,
  deleteCloudflareDnsRecord,
} from '@/lib/cloudflare-utils';
import { Client as SshClient } from 'ssh2'; // Import SSH Client
import { SUPERUSER_EMAILS, UserPermissions, PERMISSION_KEYS } from '@/lib/constants'; // Importación actualizada
import { createAndProvisionCloudflareTunnel, deleteCloudflareTunnelAndCleanup } from '@/lib/tunnel-orchestration'; // Import new server actions

// Esquema de validación para la creación de túneles
const createTunnelSchema = z.object({
  cloudflare_domain_id: z.string().uuid({ message: 'ID de dominio de Cloudflare inválido.' }),
  container_port: z.coerce.number().int().min(1).max(65535, { message: 'Puerto de contenedor inválido.' }),
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

// Helper to execute an SSH command and return its output
function executeSshCommand(conn: SshClient, command: string): Promise<{ stdout: string; stderr: string; code: number }> {
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

// POST /api/servers/[id]/docker/containers/[containerId]/tunnel - Crear un nuevo túnel
export async function POST(
  req: NextRequest,
  context: any // Simplified type to resolve internal Next.js type conflict
) {
  const serverId = context.params.id;
  const containerId = context.params.containerId;

  if (!serverId || !containerId) {
    return NextResponse.json({ message: 'ID de servidor o contenedor no proporcionado.' }, { status: 400 });
  }

  const { session, userRole, userPermissions } = await getSessionAndRole();
  if (!session || !userRole) {
    return NextResponse.json({ message: 'Acceso denegado. No autenticado.' }, { status: 401 });
  }
  // Only Super Admins can create tunnels
  if (!userPermissions[PERMISSION_KEYS.CAN_MANAGE_CLOUDFLARE_TUNNELS]) {
    return NextResponse.json({ message: 'Acceso denegado. No tienes permiso para crear túneles.' }, { status: 403 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set.');
    return NextResponse.json({ message: 'Error de configuración del servidor.' }, { status: 500 });
  }

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const body = await req.json();
    const { cloudflare_domain_id, container_port, subdomain: userSubdomain } = createTunnelSchema.parse(body);

    // 1. Fetch server details
    const { data: server, error: serverError } = await supabaseAdmin
      .from('user_servers')
      .select('ip_address, ssh_port, ssh_username, ssh_password, name')
      .eq('id', serverId)
      .single();

    if (serverError || !server) {
      throw new Error('Servidor no encontrado o acceso denegado.');
    }

    // 2. Fetch Cloudflare domain details
    const { data: fetchedCfDomain, error: cfDomainError } = await supabaseAdmin
      .from('cloudflare_domains')
      .select('domain_name, api_token, zone_id, account_id')
      .eq('id', cloudflare_domain_id)
      .eq('user_id', session.user.id)
      .single();

    if (cfDomainError || !fetchedCfDomain) {
      throw new Error('Dominio de Cloudflare no encontrado o acceso denegado.');
    }

    // 3. Dynamically get the host_port for the container
    const conn = new SshClient();
    let hostPort: number | undefined;
    try {
      await new Promise<void>((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect({
        host: server.ip_address,
        port: server.ssh_port || 22,
        username: server.ssh_username,
        password: server.ssh_password,
        readyTimeout: 10000,
      }));

      const dockerPortCommand = `docker port ${containerId} ${container_port}`;
      const { stdout: portOutput, stderr: portStderr, code: portCode } = await executeSshCommand(conn, dockerPortCommand);

      if (portCode !== 0) {
        throw new Error(`Error al obtener el puerto del host para el contenedor: ${portStderr}`);
      }

      // Expected output format: 0.0.0.0:HOST_PORT or HOST_IP:HOST_PORT
      const match = portOutput.trim().match(/:(\d+)$/);
      if (!match || !match[1]) {
        throw new Error(`No se pudo parsear el puerto del host de la salida: ${portOutput.trim()}`);
      }
      hostPort = parseInt(match[1], 10);

    } finally {
      conn.end();
    }

    if (!hostPort) {
      throw new Error('No se pudo determinar el puerto del host para el contenedor.');
    }

    // Call the new server action to create and provision the tunnel
    const { tunnelId: newTunnelRecordId } = await createAndProvisionCloudflareTunnel({
      userId: session.user.id,
      serverId: serverId,
      containerId: containerId,
      cloudflareDomainId: cloudflare_domain_id,
      containerPort: container_port,
      hostPort: hostPort, // <-- Ahora se pasa el hostPort
      subdomain: userSubdomain,
      serverDetails: {
        ip_address: server.ip_address,
        ssh_port: server.ssh_port || 22,
        ssh_username: server.ssh_username,
        ssh_password: server.ssh_password,
        name: server.name,
      },
      cloudflareDomainDetails: fetchedCfDomain,
    });

    return NextResponse.json(
      { message: 'Túnel de Cloudflare creado y aprovisionamiento iniciado.', tunnelId: newTunnelRecordId },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Error creating Cloudflare tunnel:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: `Error al crear el túnel: ${error.message}` }, { status: 500 });
  }
}

// DELETE /api/servers/[id]/docker/containers/[containerId]/tunnel - Eliminar un túnel existente
export async function DELETE(
  req: NextRequest,
  context: any // Simplified type to resolve internal Next.js type conflict
) {
  const serverId = context.params.id;
  const containerId = context.params.containerId;
  const { searchParams } = new URL(req.url);
  const tunnelRecordId = searchParams.get('tunnelRecordId'); // Get tunnelRecordId from query params

  if (!serverId || !containerId || !tunnelRecordId) {
    return NextResponse.json({ message: 'ID de servidor, contenedor o registro de túnel no proporcionado.' }, { status: 400 });
  }

  const { session, userRole, userPermissions } = await getSessionAndRole();
  if (!session || !userRole) {
    return NextResponse.json({ message: 'Acceso denegado. No autenticado.' }, { status: 401 });
  }
  // Only Super Admins can delete tunnels
  if (!userPermissions[PERMISSION_KEYS.CAN_MANAGE_CLOUDFLARE_TUNNELS]) {
    return NextResponse.json({ message: 'Acceso denegado. No tienes permiso para eliminar túneles.' }, { status: 403 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set.');
    return NextResponse.json({ message: 'Error de configuración del servidor.' }, { status: 500 });
  }

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  try {
    // 1. Fetch tunnel details from Supabase to get its ID and associated domain
    const { data: tunnelRecord, error: tunnelRecordError } = await supabaseAdmin
      .from('docker_tunnels')
      .select('id, cloudflare_domain_id')
      .eq('id', tunnelRecordId)
      .eq('server_id', serverId)
      .eq('container_id', containerId)
      .eq('user_id', session.user.id)
      .single();

    if (tunnelRecordError || !tunnelRecord) {
      throw new Error('Túnel no encontrado o acceso denegado.');
    }

    // 2. Fetch Cloudflare domain details to get API token and zone ID
    const { data: cfDomain, error: cfDomainError } = await supabaseAdmin
      .from('cloudflare_domains')
      .select('domain_name, api_token, zone_id, account_id')
      .eq('id', tunnelRecord.cloudflare_domain_id)
      .eq('user_id', session.user.id)
      .single();

    if (cfDomainError || !cfDomain) {
      throw new Error('Dominio de Cloudflare asociado al túnel no encontrado o acceso denegado.');
    }

    // 3. Fetch server details for SSH connection
    const { data: serverDetails, error: serverDetailsError } = await supabaseAdmin
      .from('user_servers')
      .select('ip_address, ssh_port, ssh_username, ssh_password, name')
      .eq('id', serverId)
      .eq('user_id', session.user.id)
      .single();

    if (serverDetailsError || !serverDetails) {
      throw new Error('Detalles del servidor no encontrados o acceso denegado.');
    }

    // Call the new server action to delete the tunnel and clean up
    await deleteCloudflareTunnelAndCleanup({
      userId: session.user.id,
      serverId: serverId,
      containerId: containerId,
      tunnelRecordId: tunnelRecord.id,
      serverDetails: {
        ip_address: serverDetails.ip_address,
        ssh_port: serverDetails.ssh_port || 22,
        ssh_username: serverDetails.ssh_username,
        ssh_password: serverDetails.ssh_password,
        name: serverDetails.name,
      },
      cloudflareDomainDetails: cfDomain,
    });

    return NextResponse.json({ message: 'Túnel de Cloudflare eliminado correctamente.' }, { status: 200 });

  } catch (error: any) {
    console.error('Error deleting Cloudflare tunnel:', error);
    return NextResponse.json({ message: `Error al eliminar el túnel: ${error.message}` }, { status: 500 });
  }
}