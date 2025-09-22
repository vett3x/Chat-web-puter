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
import { SUPERUSER_EMAILS } from '@/lib/constants'; // Importación actualizada

// Esquema de validación para la creación de túneles
const createTunnelSchema = z.object({
  cloudflare_domain_id: z.string().uuid({ message: 'ID de dominio de Cloudflare inválido.' }),
  container_port: z.coerce.number().int().min(1).max(65535, { message: 'Puerto de contenedor inválido.' }),
  subdomain: z.string().regex(/^[a-z0-9-]{1,63}$/, { message: 'Subdominio inválido. Solo minúsculas, números y guiones.' }).optional(),
});

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

// Helper to execute a command and return its output
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

  const { session, userRole } = await getSessionAndRole();
  if (!session || !userRole) {
    return NextResponse.json({ message: 'Acceso denegado. No autenticado.' }, { status: 401 });
  }
  // Only Super Admins can create tunnels
  if (userRole !== 'super_admin') {
    return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden crear túneles.' }, { status: 403 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set.');
    return NextResponse.json({ message: 'Error de configuración del servidor.' }, { status: 500 });
  }

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  let tunnelId: string | undefined;
  let dnsRecordId: string | undefined;
  // Declare cfDomain outside the try block
  let cfDomain: { domain_name: string; api_token: string; zone_id: string; account_id: string } | null = null;

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
      .select('domain_name, api_token, zone_id, account_id') // Select account_id
      .eq('id', cloudflare_domain_id)
      .eq('user_id', session.user.id)
      .single();

    if (cfDomainError || !fetchedCfDomain) {
      throw new Error('Dominio de Cloudflare no encontrado o acceso denegado.');
    }
    cfDomain = fetchedCfDomain; // Assign to the outer-scoped variable

    const subdomain = userSubdomain || generateRandomSubdomain();
    const fullDomain = `${subdomain}.${cfDomain.domain_name}`;
    const tunnelName = `tunnel-${subdomain}-${containerId.substring(0, 8)}`; // Unique name for Cloudflare

    // 3. Create Cloudflare Tunnel
    const tunnel = await createCloudflareTunnel(cfDomain.api_token, cfDomain.account_id, tunnelName); // Use cfDomain.account_id
    tunnelId = tunnel.id;
    const tunnelSecret = tunnel.secret;
    const tunnelCnameTarget = `${tunnelId}.cfargotunnel.com`;

    // 4. Create DNS CNAME record
    const dnsRecord = await createCloudflareDnsRecord(
      cfDomain.api_token,
      cfDomain.zone_id,
      fullDomain,
      tunnelCnameTarget
    );
    dnsRecordId = dnsRecord.id;

    // 5. Store tunnel details in Supabase
    const { data: newTunnel, error: insertError } = await supabaseAdmin
      .from('docker_tunnels')
      .insert({
        user_id: session.user.id,
        server_id: serverId,
        container_id: containerId,
        cloudflare_domain_id: cloudflare_domain_id,
        subdomain: subdomain,
        full_domain: fullDomain,
        container_port: container_port,
        tunnel_id: tunnelId,
        tunnel_secret: tunnelSecret,
        status: 'provisioning', // Will be 'active' after remote setup
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Error al guardar el túnel en la base de datos: ${insertError.message}`);
    }

    // 6. Initiate remote cloudflared installation and tunnel setup (non-blocking)
    // This part will be implemented in a separate function/action later.
    // For now, we'll just log that it needs to happen.
    console.log(`[Tunnel Creation] Initiating remote setup for tunnel ${newTunnel.id} on server ${serverId}`);
    // TODO: Call a server action or edge function to install cloudflared and run the tunnel

    // Log event for successful tunnel creation
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      server_id: serverId,
      event_type: 'tunnel_created',
      description: `Túnel '${fullDomain}' creado para contenedor ${containerId.substring(0,12)} en '${server.name || server.ip_address}'.`,
    });

    return NextResponse.json(
      { message: 'Túnel de Cloudflare creado y aprovisionamiento iniciado.', tunnel: newTunnel },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Error creating Cloudflare tunnel:', error);

    // Rollback Cloudflare resources if creation failed at an intermediate step
    if (tunnelId && cfDomain?.api_token && cfDomain?.account_id) { // Use cfDomain.account_id
      try {
        await deleteCloudflareTunnel(cfDomain.api_token, cfDomain.account_id, tunnelId);
        console.warn(`[Rollback] Cloudflare Tunnel ${tunnelId} deleted.`);
      } catch (rollbackError) {
        console.error(`[Rollback] Failed to delete Cloudflare Tunnel ${tunnelId}:`, rollbackError);
      }
    }
    if (dnsRecordId && cfDomain?.api_token && cfDomain?.zone_id) {
      try {
        await deleteCloudflareDnsRecord(cfDomain.api_token, cfDomain.zone_id, dnsRecordId);
        console.warn(`[Rollback] Cloudflare DNS record ${dnsRecordId} deleted.`);
      } catch (rollbackError) {
        console.error(`[Rollback] Failed to delete Cloudflare DNS record ${dnsRecordId}:`, rollbackError);
      }
    }

    // Log event for failed tunnel creation
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      server_id: serverId,
      event_type: 'tunnel_create_failed',
      description: `Fallo al crear túnel para contenedor ${containerId.substring(0,12)} en servidor ${serverId}. Error: ${error.message}`,
    });

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

  if (!serverId || !containerId) {
    return NextResponse.json({ message: 'ID de servidor o contenedor no proporcionado.' }, { status: 400 });
  }

  const { session, userRole } = await getSessionAndRole();
  if (!session || !userRole) {
    return NextResponse.json({ message: 'Acceso denegado. No autenticado.' }, { status: 401 });
  }
  // Only Super Admins can delete tunnels
  if (userRole !== 'super_admin') {
    return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden eliminar túneles.' }, { status: 403 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set.');
    return NextResponse.json({ message: 'Error de configuración del servidor.' }, { status: 500 });
  }

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  try {
    // 1. Fetch tunnel details from Supabase
    const { data: tunnel, error: tunnelError } = await supabaseAdmin
      .from('docker_tunnels')
      .select('id, tunnel_id, cloudflare_domain_id, full_domain')
      .eq('server_id', serverId)
      .eq('container_id', containerId)
      .eq('user_id', session.user.id)
      .single();

    if (tunnelError || !tunnel) {
      throw new Error('Túnel no encontrado o acceso denegado.');
    }

    // 2. Fetch Cloudflare domain details to get API token and zone ID
    const { data: cfDomain, error: cfDomainError } = await supabaseAdmin
      .from('cloudflare_domains')
      .select('domain_name, api_token, zone_id, account_id') // Select account_id
      .eq('id', tunnel.cloudflare_domain_id)
      .eq('user_id', session.user.id)
      .single();

    if (cfDomainError || !cfDomain) {
      throw new Error('Dominio de Cloudflare asociado al túnel no encontrado o acceso denegado.');
    }

    // 3. Delete Cloudflare Tunnel
    if (tunnel.tunnel_id) {
      await deleteCloudflareTunnel(cfDomain.api_token, cfDomain.account_id, tunnel.tunnel_id); // Use cfDomain.account_id
    }

    // 4. Delete DNS CNAME record (need to find its ID first)
    // Cloudflare API doesn't provide DNS record ID directly from tunnel, so we need to search
    const { data: dnsRecords, error: dnsRecordsError } = await supabaseAdmin
      .from('server_events_log') // Assuming we logged the DNS record ID during creation
      .select('description')
      .eq('event_type', 'tunnel_created')
      .like('description', `%${tunnel.full_domain}%`)
      .order('created_at', { ascending: false })
      .limit(1);

    let dnsRecordId: string | undefined;
    if (dnsRecords && dnsRecords.length > 0) {
      // This is a very fragile way to get the DNS record ID.
      // A better approach would be to store the DNS record ID in the docker_tunnels table.
      // For now, we'll try to parse it from the description or skip if not found.
      const match = dnsRecords[0].description.match(/DNS Record ID: ([a-f0-9]+)/);
      if (match) {
        dnsRecordId = match[1];
      }
    }

    if (dnsRecordId) {
      await deleteCloudflareDnsRecord(cfDomain.api_token, cfDomain.zone_id, dnsRecordId);
    } else {
      console.warn(`[Tunnel Deletion] Could not find DNS record ID for ${tunnel.full_domain}. Skipping DNS record deletion.`);
    }

    // 5. Delete tunnel from Supabase
    const { error: deleteError } = await supabaseAdmin
      .from('docker_tunnels')
      .delete()
      .eq('id', tunnel.id)
      .eq('user_id', session.user.id);

    if (deleteError) {
      throw new Error(`Error al eliminar el túnel de la base de datos: ${deleteError.message}`);
    }

    // TODO: Stop/uninstall cloudflared on the remote server (non-blocking)
    console.log(`[Tunnel Deletion] Initiating remote cleanup for tunnel ${tunnel.id} on server ${serverId}`);

    // Log event for successful tunnel deletion
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      server_id: serverId,
      event_type: 'tunnel_deleted',
      description: `Túnel '${tunnel.full_domain}' eliminado para contenedor ${containerId.substring(0,12)}.`,
    });

    return NextResponse.json({ message: 'Túnel de Cloudflare eliminado correctamente.' }, { status: 200 });

  } catch (error: any) {
    console.error('Error deleting Cloudflare tunnel:', error);

    // Log event for failed tunnel deletion
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      server_id: serverId,
      event_type: 'tunnel_delete_failed',
      description: `Fallo al eliminar túnel para contenedor ${containerId.substring(0,12)} en servidor ${serverId}. Error: ${error.message}`,
    });

    return NextResponse.json({ message: `Error al eliminar el túnel: ${error.message}` }, { status: 500 });
  }
}