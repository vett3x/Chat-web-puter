"use server";

import { createClient } from '@supabase/supabase-js';
import {
  generateRandomSubdomain,
  createCloudflareTunnelApi, // New API-based tunnel creation
  deleteCloudflareTunnelApi, // New API-based tunnel deletion
  createCloudflareDnsRecord,
  deleteCloudflareDnsRecord,
  configureCloudflareTunnelIngressApi, // New API-based ingress configuration
  installAndRunCloudflaredService, // New SSH-based service installation
  uninstallCloudflaredService, // New SSH-based service uninstallation
} from '@/lib/cloudflare-utils';
import { executeSshCommand } from './ssh-utils'; // Import SSH utilities

// Initialize Supabase client with the service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  hostPort,
  subdomain: userSubdomain,
  serverDetails,
  cloudflareDomainDetails,
}: {
  userId: string;
  serverId: string;
  containerId: string;
  cloudflareDomainId: string;
  containerPort: number;
  hostPort: number;
  subdomain?: string;
  serverDetails: ServerDetails;
  cloudflareDomainDetails: CloudflareDomainDetails;
}) {
  let tunnelId: string | undefined;
  let dnsRecordId: string | undefined;
  let newTunnelRecordId: string | undefined;
  let tunnelToken: string | undefined; // Changed from tunnelSecret to tunnelToken

  try {
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

    const tunnelName = `tunnel-${containerId.substring(0, 12)}`;

    await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel] Creating Cloudflare Tunnel '${tunnelName}' via Cloudflare API...\n` });
    const createdTunnel = await createCloudflareTunnelApi(cloudflareDomainDetails.api_token, cloudflareDomainDetails.account_id, tunnelName, userId);
    
    if (!createdTunnel || !createdTunnel.tunnelId || !createdTunnel.tunnelToken) {
      throw new Error('No se pudo crear el túnel o obtener su ID/token de la API de Cloudflare.');
    }
    tunnelId = createdTunnel.tunnelId;
    tunnelToken = createdTunnel.tunnelToken; // Store the token
    await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel] Cloudflare Tunnel created successfully. ID: ${tunnelId}\n` });

    const subdomain = userSubdomain || generateRandomSubdomain();
    const fullDomain = `${subdomain}.${cloudflareDomainDetails.domain_name}`;
    const tunnelCnameTarget = `${tunnelId}.cfargotunnel.com`;
    await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel] Creating DNS CNAME record for '${fullDomain}' pointing to '${tunnelCnameTarget}'...\n` });
    const dnsRecord = await createCloudflareDnsRecord(cloudflareDomainDetails.api_token, cloudflareDomainDetails.zone_id, fullDomain, tunnelCnameTarget, userId);
    dnsRecordId = dnsRecord.id;
    await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel] DNS CNAME record created. ID: ${dnsRecordId}\n` });

    await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel] Storing tunnel details in database...\n` });
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
        host_port: hostPort,
        tunnel_id: tunnelId,
        tunnel_secret: tunnelToken, // Store the token for the credentials file
        status: 'provisioning',
      })
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`Error al guardar el túnel en la base de datos: ${insertError.message}`);
    }
    newTunnelRecordId = newTunnel.id;
    await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel] Tunnel details stored. DB Record ID: ${newTunnelRecordId}\n` });

    await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel] Configuring ingress rules via Cloudflare API...\n` });
    await configureCloudflareTunnelIngressApi(
        cloudflareDomainDetails.api_token,
        cloudflareDomainDetails.account_id,
        tunnelId,
        fullDomain,
        `http://localhost:${hostPort}`, // Service URL for ingress
        userId
    );
    await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel] Ingress rules configured.\n` });

    await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel] Installing and running cloudflared service on host via SSH...\n` });
    await installAndRunCloudflaredService(serverDetails, tunnelToken, userId);
    await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel] cloudflared service installed and running.\n` });


    await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel] Updating tunnel status to 'active' in database.\n` });
    await supabaseAdmin.from('docker_tunnels').update({ status: 'active' }).eq('id', newTunnelRecordId);

    await supabaseAdmin.from('server_events_log').insert({
      user_id: userId,
      server_id: serverId,
      event_type: 'tunnel_created',
      description: `Túnel '${fullDomain}' creado y aprovisionado para contenedor ${containerId.substring(0, 12)} en '${serverDetails.name || serverDetails.ip_address}'. DNS Record ID: ${dnsRecordId}. Host Port: ${hostPort}`,
    });
    await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel] Tunnel provisioning complete for '${fullDomain}'.\n` });

    return { message: 'Túnel de Cloudflare creado y aprovisionamiento iniciado.', tunnelId: newTunnelRecordId };

  } catch (error: any) {
    console.error('Error creating Cloudflare tunnel and provisioning:', error);
    await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel] ERROR during provisioning: ${error.message}\n` });

    // Rollback logic
    if (tunnelId) {
      try {
        await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel] Attempting rollback: Deleting Cloudflare Tunnel ${tunnelId} via API...\n` });
        await deleteCloudflareTunnelApi(cloudflareDomainDetails.api_token, cloudflareDomainDetails.account_id, tunnelId, userId);
        await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel] Rollback: Cloudflare Tunnel ${tunnelId} deleted via API.\n` });
      } catch (rollbackError) {
        console.error(`[Rollback] Failed to delete Cloudflare Tunnel ${tunnelId} via API:`, rollbackError);
        await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel] Rollback ERROR: Failed to delete Cloudflare Tunnel ${tunnelId} via API: ${rollbackError}\n` });
      }
    }
    if (dnsRecordId) {
      try {
        await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel] Attempting rollback: Deleting Cloudflare DNS record ${dnsRecordId}...\n` });
        await deleteCloudflareDnsRecord(cloudflareDomainDetails.api_token, cloudflareDomainDetails.zone_id, dnsRecordId, userId);
        await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel] Rollback: Cloudflare DNS record ${dnsRecordId} deleted.\n` });
      } catch (rollbackError) {
        console.error(`[Rollback] Failed to delete Cloudflare DNS record ${dnsRecordId}:`, rollbackError);
        await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel] Rollback ERROR: Failed to delete Cloudflare DNS record ${dnsRecordId}: ${rollbackError}\n` });
      }
    }
    if (serverDetails && tunnelToken) { // Only attempt uninstall if serverDetails and token were available
      try {
        await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel] Attempting rollback: Uninstalling cloudflared service on host via SSH...\n` });
        await uninstallCloudflaredService(serverDetails, userId);
        await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel] Rollback: cloudflared service uninstalled from host.\n` });
      } catch (rollbackError) {
        console.error(`[Rollback] Failed to uninstall cloudflared service:`, rollbackError);
        await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel] Rollback ERROR: Failed to uninstall cloudflared service: ${rollbackError}\n` });
      }
    }

    if (newTunnelRecordId) {
      await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel] Updating tunnel DB status to 'failed' for record ${newTunnelRecordId}.\n` });
      await supabaseAdmin.from('docker_tunnels').update({ status: 'failed' }).eq('id', newTunnelRecordId);
    }

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
    await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel Deletion] Fetching tunnel details from DB for record ${tunnelRecordId}...\n` });
    const { data: tunnel, error: tunnelError } = await supabaseAdmin
      .from('docker_tunnels')
      .select('id, tunnel_id, cloudflare_domain_id, full_domain, tunnel_secret') // Fetch tunnel_secret (token)
      .eq('id', tunnelRecordId)
      .eq('user_id', userId)
      .single();

    if (tunnelError || !tunnel) {
      throw new Error('Túnel no encontrado o acceso denegado.');
    }
    await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel Deletion] Tunnel details fetched. Cloudflare Tunnel ID: ${tunnel.tunnel_id}\n` });

    await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel Deletion] Deleting Cloudflare Tunnel ${tunnel.tunnel_id} via API...\n` });
    await deleteCloudflareTunnelApi(cloudflareDomainDetails.api_token, cloudflareDomainDetails.account_id, tunnel.tunnel_id, userId);
    await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel Deletion] Cloudflare Tunnel ${tunnel.tunnel_id} deleted via API.\n` });

    await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel Deletion] Searching for DNS record ID for ${tunnel.full_domain}...\n` });
    const { data: dnsRecords } = await supabaseAdmin
      .from('server_events_log')
      .select('description')
      .eq('event_type', 'tunnel_created')
      .like('description', `%${tunnel.full_domain}%`)
      .order('created_at', { ascending: false })
      .limit(1);

    let dnsRecordId: string | undefined;
    if (dnsRecords && dnsRecords.length > 0) {
      const match = dnsRecords[0].description.match(/DNS Record ID: ([a-fA-F0-9]{32})/);
      if (match) {
        dnsRecordId = match[1];
        await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel Deletion] Found DNS Record ID: ${dnsRecordId}\n` });
      }
    }

    if (dnsRecordId) {
      await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel Deletion] Deleting Cloudflare DNS record ${dnsRecordId}...\n` });
      await deleteCloudflareDnsRecord(cloudflareDomainDetails.api_token, cloudflareDomainDetails.zone_id, dnsRecordId, userId);
      await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel Deletion] Cloudflare DNS record ${dnsRecordId} deleted.\n` });
    } else {
      await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel Deletion] WARNING: Could not find DNS record ID for ${tunnel.full_domain}. Skipping DNS record deletion.\n` });
    }

    await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel Deletion] Uninstalling cloudflared service on host via SSH...\n` });
    await uninstallCloudflaredService(serverDetails, userId);
    await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel Deletion] cloudflared service uninstalled from host.\n` });

    await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel Deletion] Deleting tunnel record ${tunnel.id} from database...\n` });
    const { error: deleteError } = await supabaseAdmin
      .from('docker_tunnels')
      .delete()
      .eq('id', tunnel.id)
      .eq('user_id', userId);

    if (deleteError) {
      throw new Error(`Error al eliminar el túnel de la base de datos: ${deleteError.message}`);
    }
    await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel Deletion] Tunnel record ${tunnel.id} deleted from database.\n` });

    await supabaseAdmin.from('server_events_log').insert({
      user_id: userId,
      server_id: serverId,
      event_type: 'tunnel_deleted',
      description: `Túnel '${tunnel.full_domain}' eliminado para contenedor ${containerId.substring(0, 12)}.`,
    });
    await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel Deletion] Tunnel deletion process complete for '${tunnel.full_domain}'.\n` });

    return { message: 'Túnel de Cloudflare eliminado correctamente.' };

  } catch (error: any) {
    console.error('Error deleting Cloudflare tunnel and cleaning up:', error);
    await supabaseAdmin.rpc('append_to_provisioning_log', { server_id: serverId, log_content: `[Tunnel Deletion] ERROR during deletion: ${error.message}\n` });

    await supabaseAdmin.from('server_events_log').insert({
      user_id: userId,
      server_id: serverId,
      event_type: 'tunnel_delete_failed',
      description: `Fallo al eliminar túnel para contenedor ${containerId.substring(0, 12)} en servidor ${serverId}. Error: ${error.message}`,
    });

    throw new Error(`Error al eliminar el túnel: ${error.message}`);
  }
}