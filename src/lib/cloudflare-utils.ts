import { z } from 'zod';
import { randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { executeSshCommand, writeRemoteFile } from './ssh-utils'; // Import SSH utilities

// Initialize Supabase client with the service role key for logging
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  : null;

// Helper para registrar eventos en la base de datos
async function logApiCall(userId: string | undefined, eventType: string, description: string) {
  if (!supabaseAdmin || !userId) {
    console.log(`[API Log - User: ${userId || 'N/A'}] ${eventType}: ${description}`);
    return;
  }
  try {
    await supabaseAdmin.from('server_events_log').insert({
      user_id: userId,
      event_type: eventType,
      description: description,
    });
  } catch (error) {
    console.error('Error logging API call to Supabase:', error);
  }
}

// Helper para generar un subdominio aleatorio de 15 caracteres (minúsculas y números)
export function generateRandomSubdomain(length: number = 15): string {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

// Esquema para validar la respuesta de la API de Cloudflare - AHORA MÁS FLEXIBLE
const cloudflareApiResponseSchema = z.object({
  success: z.boolean().optional(), // success es ahora opcional
  errors: z.array(z.object({
    code: z.number(),
    message: z.string(),
  })).optional(),
  messages: z.array(z.object({
    code: z.number(),
    message: z.string(),
  })).optional(),
  result: z.any().optional(),
});

interface CloudflareApiOptions {
  apiToken: string;
  zoneId?: string; // Zone ID is optional for some calls (e.g., creating tunnels)
  userId?: string; // User ID for logging purposes
}

// Función genérica para llamar a la API de Cloudflare
async function callCloudflareApi<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  options: CloudflareApiOptions,
  body?: any
): Promise<T> {
  const { apiToken, zoneId, userId } = options;
  const baseUrl = 'https://api.cloudflare.com/client/v4';
  let url = `${baseUrl}${path}`;

  const safeBody = body ? JSON.stringify(body) : 'N/A';
  const logDescriptionRequest = `[Cloudflare API Request]
- Method: ${method}
- URL: ${url}
- API Token: ${apiToken.substring(0, 4)}...${apiToken.substring(apiToken.length - 4)}
- Body: ${safeBody}`;
  
  await logApiCall(userId, 'cloudflare_api_request', logDescriptionRequest);

  const headers: HeadersInit = {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  };

  const config: RequestInit = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(url, config);
  
  const responseText = await response.text();
  
  let data;
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch (e) {
    const logDescriptionError = `[Cloudflare API Response]
- Status: ${response.status}
- Error: Failed to parse JSON response.
- Response Body: ${responseText}`;
    await logApiCall(userId, 'cloudflare_api_response_error', logDescriptionError);
    throw new Error("La respuesta de la API de Cloudflare no es un JSON válido.");
  }

  const parsedData = cloudflareApiResponseSchema.safeParse(data);

  if (!parsedData.success) {
    const logDescriptionValidationError = `[Cloudflare API Response]
- Status: ${response.status}
- Error: Zod validation failed.
- Response Body: ${responseText}`;
    await logApiCall(userId, 'cloudflare_api_response_error', logDescriptionValidationError);
    // Lanzar el error de Zod para una mejor depuración si es necesario
    throw new Error(`Error de validación de la respuesta de la API de Cloudflare: ${parsedData.error.message}`);
  }

  // Lógica de error mejorada: considera success: false O la presencia de errores
  if (parsedData.data.success === false || (parsedData.data.errors && parsedData.data.errors.length > 0)) {
    const errorMessages = parsedData.data.errors?.map((e: { code: number; message: string }) => `(Code: ${e.code}) ${e.message}`).join('; ') || 'Error desconocido de Cloudflare API.';
    const logDescriptionApiError = `[Cloudflare API Response]
- Status: ${response.status}
- Success: false
- Errors: ${errorMessages}
- Response Body: ${responseText}`;
    await logApiCall(userId, 'cloudflare_api_response_error', logDescriptionApiError);
    throw new Error(`Error de Cloudflare API: ${errorMessages}`);
  }

  const logDescriptionSuccess = `[Cloudflare API Response]
- Status: ${response.status}
- Success: true
- Response Body: ${responseText.substring(0, 500)}${responseText.length > 500 ? '...' : ''}`;
  await logApiCall(userId, 'cloudflare_api_response_success', logDescriptionSuccess);

  return parsedData.data.result as T;
}

// --- Tunnel Management (Adapted for Legacy Tunnels via SSH) ---

interface ServerDetails {
  ip_address: string;
  ssh_port: number;
  ssh_username: string;
  ssh_password?: string;
  name?: string;
}

interface CloudflareDomainDetails { // New interface to pass to createCloudflareTunnel
  domain_name: string;
  api_token: string;
  zone_id: string;
  account_id: string;
}

interface CreatedLegacyTunnel {
  tunnelId: string;
  tunnelSecret: string; // This is the token for the credentials file
}

/**
 * Creates a legacy Cloudflare tunnel on the remote server via SSH.
 * It runs 'cloudflared tunnel create' and parses the output for ID and secret.
 */
export async function createCloudflareTunnel(
  serverDetails: ServerDetails,
  tunnelName: string,
  cloudflareDomainDetails: CloudflareDomainDetails, // ADDED THIS PARAMETER
  userId?: string,
): Promise<CreatedLegacyTunnel> {
  await logApiCall(userId, 'cloudflare_tunnel_create_ssh', `Attempting to create legacy tunnel '${tunnelName}' on ${serverDetails.ip_address} via SSH.`);

  // 1. Ensure the .cloudflared directory exists for the root user
  await executeSshCommand(serverDetails, 'mkdir -p /root/.cloudflared');
  await logApiCall(userId, 'cloudflare_tunnel_create_ssh_mkdir', `Ensured /root/.cloudflared directory exists on ${serverDetails.ip_address}.`);

  // 2. Install origin certificate (cert.pem)
  // This command requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID environment variables
  const installCertCommand = `bash -c 'CLOUDFLARE_API_TOKEN="${cloudflareDomainDetails.api_token}" CLOUDFLARE_ACCOUNT_ID="${cloudflareDomainDetails.account_id}" cloudflared tunnel origin-cert install'`;
  await logApiCall(userId, 'cloudflare_origin_cert_install_ssh', `Attempting to install origin certificate on ${serverDetails.ip_address}.`);
  const { stdout: certStdout, stderr: certStderr, code: certCode } = await executeSshCommand(serverDetails, installCertCommand);

  if (certCode !== 0) {
    await logApiCall(userId, 'cloudflare_origin_cert_install_ssh_failed', `Failed to install origin certificate on ${serverDetails.ip_address}. STDERR: ${certStderr}`);
    throw new Error(`Error installing Cloudflare origin certificate via SSH: ${certStderr}`);
  }
  await logApiCall(userId, 'cloudflare_origin_cert_install_ssh_success', `Origin certificate installed successfully on ${serverDetails.ip_address}. STDOUT: ${certStdout}`);


  // 3. Create the tunnel (cloudflared should now find cert.pem automatically)
  // Removed TUNNEL_ORIGIN_CERT="" and --config /dev/null
  const command = `cloudflared tunnel create ${tunnelName}`;
  const { stdout, stderr, code } = await executeSshCommand(serverDetails, command);

  if (code !== 0) {
    await logApiCall(userId, 'cloudflare_tunnel_create_ssh_failed', `Failed to create tunnel '${tunnelName}' on ${serverDetails.ip_address}. STDERR: ${stderr}`);
    throw new Error(`Error creating Cloudflare tunnel via SSH: ${stderr}`);
  }

  const tunnelIdMatch = stdout.match(/Tunnel ID: ([a-f0-9-]+)/);
  const tunnelSecretMatch = stdout.match(/Tunnel secret: ([a-zA-Z0-9=]+)/);

  if (!tunnelIdMatch || !tunnelSecretMatch) {
    await logApiCall(userId, 'cloudflare_tunnel_create_ssh_failed', `Failed to parse tunnel ID or secret from cloudflared output. STDOUT: ${stdout}`);
    throw new Error(`Could not parse tunnel ID or secret from cloudflared output. Output: ${stdout}`);
  }

  const tunnelId = tunnelIdMatch[1];
  const tunnelSecret = tunnelSecretMatch[1]; // This is the base64 encoded token

  // Create the credentials file on the remote server
  const credentialsFileContent = JSON.stringify({ AccountTag: serverDetails.name, TunnelSecret: tunnelSecret, TunnelID: tunnelId }); // AccountTag is not strictly needed but good for context
  const credentialsFilePath = `/root/.cloudflared/${tunnelId}.json`; // Assuming root user for now
  await writeRemoteFile(serverDetails, credentialsFilePath, credentialsFileContent, '0600');
  await logApiCall(userId, 'cloudflare_tunnel_create_ssh_success', `Legacy tunnel '${tunnelName}' (ID: ${tunnelId}) created and credentials file written on ${serverDetails.ip_address}.`);

  return { tunnelId, tunnelSecret };
}

/**
 * Configures the ingress rules for a legacy Cloudflare tunnel by writing a config.yml file
 * and restarting the cloudflared service on the remote server via SSH.
 */
export async function configureCloudflareTunnelIngress(
  serverDetails: ServerDetails,
  tunnelId: string,
  fullDomain: string,
  hostPort: number,
  userId?: string,
): Promise<void> {
  await logApiCall(userId, 'cloudflare_tunnel_ingress_ssh', `Configuring ingress for tunnel ${tunnelId} on ${serverDetails.ip_address} for domain ${fullDomain} to port ${hostPort}.`);

  const configContent = `
tunnel: ${tunnelId}
credentials-file: /root/.cloudflared/${tunnelId}.json
ingress:
  - hostname: ${fullDomain}
    service: http://localhost:${hostPort}
  - service: http_status:404
`;
  const configFilePath = `/etc/cloudflared/config.yml`;

  await writeRemoteFile(serverDetails, configFilePath, configContent, '0644');
  await logApiCall(userId, 'cloudflare_tunnel_ingress_ssh_config_written', `Config.yml written for tunnel ${tunnelId} on ${serverDetails.ip_address}.`);

  // Restart cloudflared service to apply new config
  const { stderr, code } = await executeSshCommand(serverDetails, 'systemctl restart cloudflared');
  if (code !== 0) {
    await logApiCall(userId, 'cloudflare_tunnel_ingress_ssh_failed', `Failed to restart cloudflared service for tunnel ${tunnelId} on ${serverDetails.ip_address}. STDERR: ${stderr}`);
    throw new Error(`Error restarting cloudflared service: ${stderr}`);
  }
  await logApiCall(userId, 'cloudflare_tunnel_ingress_ssh_success', `Cloudflared service restarted for tunnel ${tunnelId} on ${serverDetails.ip_address}. Ingress configured.`);
}

/**
 * Deletes a legacy Cloudflare tunnel on the remote server via SSH.
 * It stops the service, deletes the tunnel, and removes associated files.
 */
export async function deleteCloudflareTunnel(
  serverDetails: ServerDetails,
  tunnelId: string,
  userId?: string,
): Promise<void> {
  await logApiCall(userId, 'cloudflare_tunnel_delete_ssh', `Attempting to delete legacy tunnel ${tunnelId} on ${serverDetails.ip_address} via SSH.`);

  // Stop cloudflared service
  await executeSshCommand(serverDetails, 'systemctl stop cloudflared').catch(e => console.warn(`[CloudflareUtils] Could not stop cloudflared service cleanly for tunnel ${tunnelId}: ${e.message}`));

  // Delete the tunnel (removed --config /dev/null and TUNNEL_ORIGIN_CERT="")
  const { stderr: deleteStderr, code: deleteCode } = await executeSshCommand(serverDetails, `cloudflared tunnel delete ${tunnelId} -f`);
  if (deleteCode !== 0 && !deleteStderr.includes('No such tunnel')) { // Allow "No such tunnel" as a non-error
    await logApiCall(userId, 'cloudflare_tunnel_delete_ssh_failed', `Failed to delete tunnel ${tunnelId} on ${serverDetails.ip_address}. STDERR: ${deleteStderr}`);
    throw new Error(`Error deleting Cloudflare tunnel via SSH: ${deleteStderr}`);
  }

  // Remove config.yml, credentials file, and cert.pem
  await executeSshCommand(serverDetails, `rm -f /etc/cloudflared/config.yml`).catch(e => console.warn(`[CloudflareUtils] Could not remove config.yml for tunnel ${tunnelId}: ${e.message}`));
  await executeSshCommand(serverDetails, `rm -f /root/.cloudflared/${tunnelId}.json`).catch(e => console.warn(`[CloudflareUtils] Could not remove credentials file for tunnel ${tunnelId}: ${e.message}`));
  await executeSshCommand(serverDetails, `rm -f /root/.cloudflared/cert.pem`).catch(e => console.warn(`[CloudflareUtils] Could not remove cert.pem for tunnel ${tunnelId}: ${e.message}`)); // NEW: remove cert.pem

  await logApiCall(userId, 'cloudflare_tunnel_delete_ssh_success', `Legacy tunnel ${tunnelId} deleted and files removed on ${serverDetails.ip_address}.`);
}

// --- DNS Record Management (Remains API-based) ---

interface CloudflareDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  zone_id: string;
  zone_name: string;
}

export async function createCloudflareDnsRecord(
  apiToken: string,
  zoneId: string,
  recordName: string, // e.g., "subdomain" or "subdomain.example.com"
  recordContent: string, // e.g., "tunnel-id.cfargotunnel.com"
  userId?: string,
  recordType: 'CNAME' | 'A' | 'AAAA' = 'CNAME',
  proxied: boolean = true // Cloudflare proxy by default
): Promise<CloudflareDnsRecord> {
  const path = `/zones/${zoneId}/dns_records`;
  const body = {
    type: recordType,
    name: recordName,
    content: recordContent,
    proxied: proxied,
    ttl: 1, // Automatic TTL
  };
  return callCloudflareApi<CloudflareDnsRecord>('POST', path, { apiToken, zoneId, userId }, body);
}

export async function deleteCloudflareDnsRecord(
  apiToken: string,
  zoneId: string,
  recordId: string,
  userId?: string,
): Promise<void> {
  const path = `/zones/${zoneId}/dns_records/${recordId}`;
  await callCloudflareApi<void>('DELETE', path, { apiToken, zoneId, userId });
}