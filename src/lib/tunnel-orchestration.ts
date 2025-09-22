"use server";

import { createClient } from '@supabase/supabase-js';
import { Client as SshClient } from 'ssh2';
import {
  generateRandomSubdomain,
  createCloudflareTunnel,
  deleteCloudflareTunnel,
  createCloudflareDnsRecord,
  deleteCloudflareDnsRecord,
} from '@/lib/cloudflare-utils';

// Initialize Supabase client with the service role key
// This allows us to bypass RLS and update the server status from the backend.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper to execute an SSH command and return its output
async function executeSshCommand(conn: SshClient, command: string): Promise<{ stdout: string; stderr: string; code: number }> {
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

interface ServerDetails {
  ip_address: string;
  ssh_port: number;
  ssh_username: string;
  ssh_password?: string;
  name?: string;
}

interface CloudflareDomainDetails {
  domain_name: string;
  api_token: string;
  zone_id: string;
  account_id: string;
}

export async function createAndProvisionCloudflareTunnel({
  userId,
  serverId,
  containerId,
  cloudflareDomainId,
  containerPort,
  hostPort, // Puerto del host
  subdomain: userSubdomain,
  serverDetails,
  cloudflareDomainDetails,
}: {
  userId: string;
  serverId: string;
  containerId: string;
  cloudflareDomainId: string;
  containerPort: number;
  hostPort: number; // Ahora es requerido
  subdomain?: string;
  serverDetails: ServerDetails;
  cloudflareDomainDetails: CloudflareDomainDetails;
}) {
  let tunnelId: string | undefined;
  let dnsRecordId: string | undefined;
  let newTunnelRecordId: string | undefined; // To store the ID of the new tunnel record in DB

  try {
    // --- Verificar si ya existe un túnel antes de crear uno nuevo ---
    const { data: existingTunnels, error: existingTunnelError } = await supabaseAdmin
      .from('docker_tunnels')
      .select('id, status, full_domain')
      .eq('server_id', serverId)
      .eq('container_id', containerId)
      .eq('container_port', containerPort)
      .eq('user_id', userId);

    if (existingTunnelError) {
      throw new Error(`Error al verificar túneles existentes: ${existingTunnelError.message}`);
    }

    if (existingTunnels && existingTunnels.length > 0) {
      const activeOrProvisioningTunnel = existingTunnels.find(t => t.status === 'active' || t.status === 'provisioning');
      if (activeOrProvisioningTunnel) {
        throw new Error(`Ya existe un túnel activo o en aprovisionamiento para este contenedor y puerto (${activeOrProvisioningTunnel.full_domain || 'sin dominio'}).`);
      }
      throw new Error(`Ya existe un túnel (posiblemente fallido) para este contenedor y puerto. Por favor, elimínalo primero si deseas crear uno nuevo.`);
    }
    // --- FIN NUEVA VERIFICACIÓN ---

    const subdomain = userSubdomain || generateRandomSubdomain();
    const fullDomain = `${subdomain}.${cloudflareDomainDetails.domain_name}`;
    const tunnelName = `tunnel-${subdomain}-${containerId.substring(0, 8)}`; // Unique name for Cloudflare

    // 1. Create Cloudflare Tunnel
    const tunnel = await createCloudflareTunnel(cloudflareDomainDetails.api_token, cloudflareDomainDetails.account_id, tunnelName);
    tunnelId = tunnel.id;
    const tunnelSecret = tunnel.secret; // This is the base64 token
    const tunnelCnameTarget = `${tunnelId}.cfargotunnel.com`;

    // 2. Create DNS CNAME record
    const dnsRecord = await createCloudflareDnsRecord(
      cloudflareDomainDetails.api_token,
      cloudflareDomainDetails.zone_id,
      fullDomain,
      tunnelCnameTarget
    );
    dnsRecordId = dnsRecord.id;

    // 3. Store tunnel details in Supabase
    const { data: newTunnel, error: insertError } = await supabaseAdmin
      .from('docker_tunnels')
      .insert({
        user_id: userId,
        server_id: serverId,
        container_id: containerId,
        cloudflare_domain_id: cloudflareDomainId,
        subdomain: subdomain,
        full_domain: fullDomain,
        container_port: containerPort,
        host_port: hostPort, // Guardar el puerto del host
        tunnel_id: tunnelId,
        tunnel_secret: tunnelSecret,
        status: 'provisioning',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error(`[Tunnel Orchestration] Error inserting tunnel into DB after initial check: ${insertError.message}`);
      throw new Error(`Error al guardar el túnel en la base de datos: ${insertError.message}`);
    }
    newTunnelRecordId = newTunnel.id;

    // 4. SSH to the remote server to configure and run the tunnel service
    const conn = new SshClient();
    await new Promise<void>((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect({
      host: serverDetails.ip_address,
      port: serverDetails.ssh_port,
      username: serverDetails.ssh_username,
      password: serverDetails.ssh_password,
      readyTimeout: 20000,
    }));

    // Define the service suffix for consistency
    const serviceSuffix = `tunnel-${tunnelId}`;
    const fullServiceName = `cloudflared-${serviceSuffix}`; // This is the actual systemd service name

    // Install cloudflared as a system service for this specific tunnel using --token
    // The --name argument here is the suffix for the systemd service unit file
    const serviceInstallCommand = `cloudflared service install --token ${tunnelSecret} --hostname ${fullDomain} --url http://localhost:${hostPort} --name ${serviceSuffix}`;
    const { stderr: installServiceStderr, code: installServiceCode } = await executeSshCommand(conn, serviceInstallCommand);
    if (installServiceCode !== 0) {
      throw new Error(`Error al instalar el servicio cloudflared para el túnel: ${installServiceStderr}`);
    }

    // Reload systemd daemon to recognize the new service unit
    await executeSshCommand(conn, `systemctl daemon-reload`);

    // Start the newly installed service using its full systemd name
    const startServiceCommand = `systemctl start ${fullServiceName}`;
    const { stderr: startServiceStderr, code: startServiceCode } = await executeSshCommand(conn, startServiceCommand);
    if (startServiceCode !== 0) {
      throw new Error(`Error al iniciar el servicio cloudflared para el túnel: ${startServiceStderr}`);
    }

    conn.end();

    // 5. Update tunnel status to 'active'
    await supabaseAdmin
      .from('docker_tunnels')
      .update({ status: 'active' })
      .eq('id', newTunnelRecordId);

    // Log event for successful tunnel creation and provisioning
    await supabaseAdmin.from('server_events_log').insert({
      user_id: userId,
      server_id: serverId,
      event_type: 'tunnel_created',
      description: `Túnel '${fullDomain}' creado y aprovisionado para contenedor ${containerId.substring(0, 12)} en '${serverDetails.name || serverDetails.ip_address}'. DNS Record ID: ${dnsRecordId}. Host Port: ${hostPort}`,
    });

    return { message: 'Túnel de Cloudflare creado y aprovisionamiento iniciado.', tunnelId: newTunnelRecordId };

  } catch (error: any) {
    console.error('Error creating Cloudflare tunnel and provisioning:', error);

    // Rollback Cloudflare resources if creation failed at an intermediate step
    if (tunnelId) {
      try {
        await deleteCloudflareTunnel(cloudflareDomainDetails.api_token, cloudflareDomainDetails.account_id, tunnelId);
        console.warn(`[Rollback] Cloudflare Tunnel ${tunnelId} deleted.`);
      } catch (rollbackError) {
        console.error(`[Rollback] Failed to delete Cloudflare Tunnel ${tunnelId}:`, rollbackError);
      }
    }
    if (dnsRecordId) {
      try {
        await deleteCloudflareDnsRecord(cloudflareDomainDetails.api_token, cloudflareDomainDetails.zone_id, dnsRecordId);
        console.warn(`[Rollback] Cloudflare DNS record ${dnsRecordId} deleted.`);
      } catch (rollbackError) {
        console.error(`[Rollback] Failed to delete Cloudflare DNS record ${dnsRecordId}:`, rollbackError);
      }
    }

    // Update tunnel status to 'failed' if it was inserted
    if (newTunnelRecordId) {
      await supabaseAdmin
        .from('docker_tunnels')
        .update({ status: 'failed' })
        .eq('id', newTunnelRecordId);
    }

    // Log event for failed tunnel creation
    await supabaseAdmin.from('server_events_log').insert({
      user_id: userId,
      server_id: serverId,
      event_type: 'tunnel_create_failed',
      description: `Fallo al crear túnel para contenedor ${containerId.substring(0, 12)} en servidor ${serverId}. Error: ${error.message}`,
    });

    throw new Error(`Error al crear el túnel: ${error.message}`);
  }
}

export async function deleteCloudflareTunnelAndCleanup({
  userId,
  serverId,
  containerId,
  tunnelRecordId, // ID from docker_tunnels table
  serverDetails,
  cloudflareDomainDetails,
}: {
  userId: string;
  serverId: string;
  containerId: string;
  tunnelRecordId: string;
  serverDetails: ServerDetails;
  cloudflareDomainDetails: CloudflareDomainDetails;
}) {
  try {
    // 1. Fetch tunnel details from Supabase
    const { data: tunnel, error: tunnelError } = await supabaseAdmin
      .from('docker_tunnels')
      .select('id, tunnel_id, cloudflare_domain_id, full_domain')
      .eq('id', tunnelRecordId)
      .eq('user_id', userId)
      .single();

    if (tunnelError || !tunnel) {
      throw new Error('Túnel no encontrado o acceso denegado.');
    }

    // 2. SSH to the remote server to stop cloudflared and clean up
    const conn = new SshClient();
    await new Promise<void>((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect({
      host: serverDetails.ip_address,
      port: serverDetails.ssh_port,
      username: serverDetails.ssh_username,
      password: serverDetails.ssh_password,
      readyTimeout: 20000,
    }));

    const serviceSuffix = `tunnel-${tunnel.tunnel_id}`;
    const fullServiceName = `cloudflared-${serviceSuffix}`;

    // Stop the specific cloudflared service
    const stopServiceCommand = `systemctl stop ${fullServiceName}`;
    const { stderr: stopStderr, code: stopCode } = await executeSshCommand(conn, stopServiceCommand);
    if (stopCode !== 0 && !stopStderr.includes('Unit cloudflared-tunnel-') && !stopStderr.includes('not loaded')) {
      console.warn(`[Tunnel Deletion] Warning: Could not stop cloudflared service for tunnel ${tunnel.tunnel_id}: ${stopStderr}`);
    }

    // Uninstall the specific cloudflared service
    const uninstallServiceCommand = `cloudflared service uninstall --name ${serviceSuffix}`;
    const { stderr: uninstallStderr, code: uninstallCode } = await executeSshCommand(conn, uninstallServiceCommand);
    if (uninstallCode !== 0 && !uninstallStderr.includes('No such file or directory')) {
      console.warn(`[Tunnel Deletion] Warning: Could not uninstall cloudflared service for tunnel ${tunnel.tunnel_id}: ${uninstallStderr}`);
    }

    // Reload systemd daemon to remove the service unit
    await executeSshCommand(conn, `systemctl daemon-reload`);

    // Clean up credentials file (created by Cloudflare API, not cloudflared service install --token)
    const configDir = `~/.cloudflared`;
    await executeSshCommand(conn, `rm -f ${configDir}/${tunnel.tunnel_id}.json`);

    conn.end();

    // 3. Delete Cloudflare Tunnel
    if (tunnel.tunnel_id) {
      await deleteCloudflareTunnel(cloudflareDomainDetails.api_token, cloudflareDomainDetails.account_id, tunnel.tunnel_id);
    }

    // 4. Delete DNS CNAME record (need to find its ID first)
    const { data: dnsRecords } = await supabaseAdmin
      .from('server_events_log')
      .select('description')
      .eq('event_type', 'tunnel_created')
      .like('description', `%${tunnel.full_domain}%`)
      .order('created_at', { ascending: false })
      .limit(1);

    let dnsRecordId: string | undefined;
    if (dnsRecords && dnsRecords.length > 0) {
      const match = dnsRecords[0].description.match(/DNS Record ID: ([a-f0-9]+)/);
      if (match) {
        dnsRecordId = match[1];
      }
    }

    if (dnsRecordId) {
      await deleteCloudflareDnsRecord(cloudflareDomainDetails.api_token, cloudflareDomainDetails.zone_id, dnsRecordId);
    } else {
      console.warn(`[Tunnel Deletion] Could not find DNS record ID for ${tunnel.full_domain}. Skipping DNS record deletion.`);
    }

    // 5. Delete tunnel from Supabase
    const { error: deleteError } = await supabaseAdmin
      .from('docker_tunnels')
      .delete()
      .eq('id', tunnel.id)
      .eq('user_id', userId);

    if (deleteError) {
      throw new Error(`Error al eliminar el túnel de la base de datos: ${deleteError.message}`);
    }

    // Log event for successful tunnel deletion
    await supabaseAdmin.from('server_events_log').insert({
      user_id: userId,
      server_id: serverId,
      event_type: 'tunnel_deleted',
      description: `Túnel '${tunnel.full_domain}' eliminado para contenedor ${containerId.substring(0, 12)}.`,
    });

    return { message: 'Túnel de Cloudflare eliminado correctamente.' };

  } catch (error: any) {
    console.error('Error deleting Cloudflare tunnel and cleaning up:', error);

    // Log event for failed tunnel deletion
    await supabaseAdmin.from('server_events_log').insert({
      user_id: userId,
      server_id: serverId,
      event_type: 'tunnel_delete_failed',
      description: `Fallo al eliminar túnel para contenedor ${containerId.substring(0, 12)} en servidor ${serverId}. Error: ${error.message}`,
    });

    throw new Error(`Error al eliminar el túnel: ${error.message}`);
  }
}