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
  hostPort, // Nuevo: puerto del host
  subdomain: userSubdomain,
  serverDetails,
  cloudflareDomainDetails,
}: {
  userId: string;
  serverId: string;
  containerId: string;
  cloudflareDomainId: string;
  containerPort: number;
  hostPort?: number; // Nuevo: puerto del host
  subdomain?: string;
  serverDetails: ServerDetails;
  cloudflareDomainDetails: CloudflareDomainDetails;
}) {
  let tunnelId: string | undefined;
  let dnsRecordId: string | undefined;
  let newTunnelRecordId: string | undefined; // To store the ID of the new tunnel record in DB

  try {
    const subdomain = userSubdomain || generateRandomSubdomain();
    const fullDomain = `${subdomain}.${cloudflareDomainDetails.domain_name}`;
    const tunnelName = `tunnel-${subdomain}-${containerId.substring(0, 8)}`;

    const tunnel = await createCloudflareTunnel(cloudflareDomainDetails.api_token, cloudflareDomainDetails.account_id, tunnelName);
    tunnelId = tunnel.id;
    const tunnelSecret = tunnel.secret;
    const tunnelCnameTarget = `${tunnelId}.cfargotunnel.com`;

    const dnsRecord = await createCloudflareDnsRecord(
      cloudflareDomainDetails.api_token,
      cloudflareDomainDetails.zone_id,
      fullDomain,
      tunnelCnameTarget
    );
    dnsRecordId = dnsRecord.id;

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
      throw new Error(`Error al guardar el túnel en la base de datos: ${insertError.message}`);
    }
    newTunnelRecordId = newTunnel.id;

    const conn = new SshClient();
    await new Promise<void>((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect({
      host: serverDetails.ip_address,
      port: serverDetails.ssh_port,
      username: serverDetails.ssh_username,
      password: serverDetails.ssh_password,
      readyTimeout: 20000,
    }));

    const configDir = `~/.cloudflared`;
    const credsFile = `${configDir}/${tunnelId}.json`;
    const mainConfigFile = `${configDir}/config.yml`;

    // Check if cloudflared service is installed and running
    const { code: serviceCheckCode } = await executeSshCommand(conn, 'systemctl is-active --quiet cloudflared');
    if (serviceCheckCode !== 0) {
      // Install and setup cloudflared as a service
      const installScript = `
        set -e
        set -x
        echo "--- Installing Cloudflared as a service ---"
        apt-get update -y && apt-get install -y curl gnupg lsb-release ca-certificates
        mkdir -p /usr/share/keyrings
        curl -fsSL https://pkg.cloudflare.com/cloudflare-release.gpg | gpg --yes --dearmor -o /usr/share/keyrings/cloudflare-archive-keyring.gpg
        echo "deb [signed-by=/usr/share/keyrings/cloudflare-archive-keyring.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/cloudflared.list > /dev/null
        apt-get update -y && apt-get install -y cloudflared
        cloudflared service install
        echo "--- Cloudflared service installed ---"
      `;
      const { stderr: installStderr, code: installCode } = await executeSshCommand(conn, installScript);
      if (installCode !== 0) {
        throw new Error(`Error al instalar el servicio cloudflared: ${installStderr}`);
      }
    }

    await executeSshCommand(conn, `mkdir -p ${configDir}`);
    await executeSshCommand(conn, `echo '${JSON.stringify(tunnel)}' > ${credsFile}`);

    // Append new ingress rule to the main config file
    const ingressRule = `
  # BEGIN INGRESS FOR ${tunnelId}
  - hostname: ${fullDomain}
    service: http://localhost:${hostPort}
    originRequest:
      noTLSVerify: true
  # END INGRESS FOR ${tunnelId}
`;
    await executeSshCommand(conn, `echo "${ingressRule}" | tee -a ${mainConfigFile}`);

    // Restart the service to apply changes
    const { stderr: restartStderr, code: restartCode } = await executeSshCommand(conn, 'systemctl restart cloudflared');
    if (restartCode !== 0) {
      throw new Error(`Error al reiniciar el servicio cloudflared: ${restartStderr}`);
    }

    conn.end();

    await supabaseAdmin
      .from('docker_tunnels')
      .update({ status: 'active' })
      .eq('id', newTunnelRecordId);

    await supabaseAdmin.from('server_events_log').insert({
      user_id: userId,
      server_id: serverId,
      event_type: 'tunnel_created',
      description: `Túnel '${fullDomain}' creado y aprovisionado para contenedor ${containerId.substring(0, 12)} en '${serverDetails.name || serverDetails.ip_address}'. DNS Record ID: ${dnsRecordId}`,
    });

    return { message: 'Túnel de Cloudflare creado y aprovisionamiento iniciado.', tunnelId: newTunnelRecordId };

  } catch (error: any) {
    console.error('Error creating Cloudflare tunnel and provisioning:', error);
    if (tunnelId) {
      try { await deleteCloudflareTunnel(cloudflareDomainDetails.api_token, cloudflareDomainDetails.account_id, tunnelId); } catch (e) { console.error(`[Rollback] Failed to delete CF Tunnel ${tunnelId}`, e); }
    }
    if (dnsRecordId) {
      try { await deleteCloudflareDnsRecord(cloudflareDomainDetails.api_token, cloudflareDomainDetails.zone_id, dnsRecordId); } catch (e) { console.error(`[Rollback] Failed to delete DNS record ${dnsRecordId}`, e); }
    }
    if (newTunnelRecordId) {
      await supabaseAdmin.from('docker_tunnels').update({ status: 'failed' }).eq('id', newTunnelRecordId);
    }
    await supabaseAdmin.from('server_events_log').insert({
      user_id: userId,
      server_id: serverId,
      event_type: 'tunnel_create_failed',
      description: `Fallo al crear túnel para contenedor ${containerId.substring(0, 12)}. Error: ${error.message}`,
    });
    throw new Error(`Error al crear el túnel: ${error.message}`);
  }
}

export async function deleteCloudflareTunnelAndCleanup({
  userId,
  serverId,
  containerId,
  tunnelRecordId,
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
    const { data: tunnel, error: tunnelError } = await supabaseAdmin
      .from('docker_tunnels')
      .select('id, tunnel_id, cloudflare_domain_id, full_domain')
      .eq('id', tunnelRecordId)
      .eq('user_id', userId)
      .single();

    if (tunnelError || !tunnel) {
      throw new Error('Túnel no encontrado o acceso denegado.');
    }

    const conn = new SshClient();
    await new Promise<void>((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect({
      host: serverDetails.ip_address,
      port: serverDetails.ssh_port,
      username: serverDetails.ssh_username,
      password: serverDetails.ssh_password,
      readyTimeout: 20000,
    }));

    // Remove ingress rule from config.yml using sed
    const mainConfigFile = `~/.cloudflared/config.yml`;
    const sedCommand = `sed -i '/# BEGIN INGRESS FOR ${tunnel.tunnel_id}/,/# END INGRESS FOR ${tunnel.tunnel_id}/d' ${mainConfigFile}`;
    await executeSshCommand(conn, sedCommand);

    // Restart service
    await executeSshCommand(conn, 'systemctl restart cloudflared');

    // Clean up credentials file
    await executeSshCommand(conn, `rm -f ~/.cloudflared/${tunnel.tunnel_id}.json`);

    conn.end();

    if (tunnel.tunnel_id) {
      await deleteCloudflareTunnel(cloudflareDomainDetails.api_token, cloudflareDomainDetails.account_id, tunnel.tunnel_id);
    }

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
      if (match) dnsRecordId = match[1];
    }

    if (dnsRecordId) {
      await deleteCloudflareDnsRecord(cloudflareDomainDetails.api_token, cloudflareDomainDetails.zone_id, dnsRecordId);
    }

    const { error: deleteError } = await supabaseAdmin
      .from('docker_tunnels')
      .delete()
      .eq('id', tunnel.id)
      .eq('user_id', userId);

    if (deleteError) {
      throw new Error(`Error al eliminar el túnel de la base de datos: ${deleteError.message}`);
    }

    await supabaseAdmin.from('server_events_log').insert({
      user_id: userId,
      server_id: serverId,
      event_type: 'tunnel_deleted',
      description: `Túnel '${tunnel.full_domain}' eliminado para contenedor ${containerId.substring(0, 12)}.`,
    });

    return { message: 'Túnel de Cloudflare eliminado correctamente.' };

  } catch (error: any) {
    console.error('Error deleting Cloudflare tunnel and cleaning up:', error);
    await supabaseAdmin.from('server_events_log').insert({
      user_id: userId,
      server_id: serverId,
      event_type: 'tunnel_delete_failed',
      description: `Fallo al eliminar túnel para contenedor ${containerId.substring(0, 12)}. Error: ${error.message}`,
    });
    throw new Error(`Error al eliminar el túnel: ${error.message}`);
  }
}