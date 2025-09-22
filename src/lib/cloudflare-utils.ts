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

// Esquema para validar la respuesta de la API de Cloudflare
const cloudflareApiResponseSchema = z.object({
  success: z.boolean(),
  errors: z.array(z.object({
    code: z.number(),
    message: z.string(),
  })),
  messages: z.array(z.object({
    code: z.number(),
    message: z.string(),
  })),
  result: z.any().optional(),
});

interface CloudflareApiOptions {
  apiToken: string;
  accountId?: string; // Account ID is now required for tunnel API calls
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
  const { apiToken, userId } = options;
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
  if (!parsedData.data.success || (parsedData.data.errors && parsedData.data.errors.length > 0)) {
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

// --- Tunnel Management (API-based) ---

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

interface CreatedCloudflareTunnelResult {
  tunnelId: string;
  tunnelToken: string; // This is the 'token' from the API response, used for `cloudflared service install`
}

/**
 * Creates a Cloudflare Tunnel using the Cloudflare API.
 */
export async function createCloudflareTunnelApi(
  apiToken: string,
  accountId: string,
  tunnelName: string,
  userId?: string,
): Promise<CreatedCloudflareTunnelResult> {
  const path = `/accounts/${accountId}/cfd_tunnel`;
  const body = {
    name: tunnelName,
    config_src: "cloudflare", // Managed remotely
  };
  const result = await callCloudflareApi<any>('POST', path, { apiToken, accountId, userId }, body);

  if (!result || !result.id || !result.token) {
    throw new Error('Failed to create tunnel or retrieve ID/token from Cloudflare API response.');
  }

  return {
    tunnelId: result.id,
    tunnelToken: result.token,
  };
}

/**
 * Configures the ingress rules for a Cloudflare Tunnel using the Cloudflare API.
 */
export async function configureCloudflareTunnelIngressApi(
  apiToken: string,
  accountId: string,
  tunnelId: string,
  fullDomain: string,
  serviceUrl: string, // e.g., "http://localhost:8001"
  userId?: string,
): Promise<void> {
  const path = `/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`;
  const body = {
    config: {
      ingress: [
        {
          hostname: fullDomain,
          service: serviceUrl,
          originRequest: {},
        },
        {
          service: "http_status:404", // Catch-all rule
        },
      ],
    },
  };
  await callCloudflareApi<any>('PUT', path, { apiToken, accountId, userId }, body);
}

/**
 * Deletes a Cloudflare Tunnel using the Cloudflare API.
 */
export async function deleteCloudflareTunnelApi(
  apiToken: string,
  accountId: string,
  tunnelId: string,
  userId?: string,
): Promise<void> {
  const path = `/accounts/${accountId}/cfd_tunnel/${tunnelId}`;
  await callCloudflareApi<any>('DELETE', path, { apiToken, accountId, userId });
}

/**
 * Installs and runs the cloudflared service on the remote server via SSH.
 */
export async function installAndRunCloudflaredService(
  serverDetails: ServerDetails,
  tunnelToken: string,
  userId?: string,
): Promise<void> {
  await logApiCall(userId, 'cloudflared_service_install_ssh', `Attempting to install and run cloudflared service on ${serverDetails.ip_address}.`);

  // The 'cloudflared service install' command handles creating the service,
  // writing the credentials file, and starting it.
  const command = `sudo cloudflared service install ${tunnelToken}`;
  const { stdout, stderr, code } = await executeSshCommand(serverDetails, command);

  if (code !== 0) {
    await logApiCall(userId, 'cloudflared_service_install_ssh_failed', `Failed to install and run cloudflared service on ${serverDetails.ip_address}. STDERR: ${stderr}`);
    throw new Error(`Error installing and running cloudflared service via SSH: ${stderr}`);
  }
  await logApiCall(userId, 'cloudflared_service_install_ssh_success', `Cloudflared service installed and running successfully on ${serverDetails.ip_address}. STDOUT: ${stdout}`);
}

/**
 * Uninstalls the cloudflared service on the remote server via SSH.
 * This function now also stops the service, cleans up connections, and removes credentials.
 */
export async function uninstallCloudflaredService(
  serverDetails: ServerDetails,
  tunnelId: string, // NEW: tunnelId is now required for cleanup
  userId?: string,
): Promise<void> {
  await logApiCall(userId, 'cloudflared_service_uninstall_ssh', `Attempting to uninstall cloudflared service for tunnel ${tunnelId} on ${serverDetails.ip_address}.`);

  // 1. Stop the cloudflared service
  await logApiCall(userId, 'cloudflared_service_stop_ssh', `Stopping cloudflared service for tunnel ${tunnelId} on ${serverDetails.ip_address}.`);
  // Use `systemctl stop cloudflared` for a clean stop. Catch error if service isn't running.
  await executeSshCommand(serverDetails, 'sudo systemctl stop cloudflared').catch(e => console.warn(`[CloudflareUtils] Could not stop cloudflared service cleanly for tunnel ${tunnelId}: ${e.message}`));

  // 2. Clean up stale connections using `cloudflared tunnel cleanup`
  await logApiCall(userId, 'cloudflared_tunnel_cleanup_ssh', `Running cloudflared tunnel cleanup for tunnel ${tunnelId} on ${serverDetails.ip_address}.`);
  const cleanupCommand = `sudo cloudflared tunnel cleanup ${tunnelId}`;
  const { stdout: cleanupStdout, stderr: cleanupStderr, code: cleanupCode } = await executeSshCommand(serverDetails, cleanupCommand);
  if (cleanupCode !== 0) {
    console.warn(`[CloudflareUtils] cloudflared tunnel cleanup for tunnel ${tunnelId} failed: ${cleanupStderr}`);
    await logApiCall(userId, 'cloudflared_tunnel_cleanup_ssh_warning', `cloudflared tunnel cleanup for tunnel ${tunnelId} failed: ${cleanupStderr}`);
    // Don't throw error here, as uninstall might still work or it might be already clean.
  } else {
    await logApiCall(userId, 'cloudflared_tunnel_cleanup_ssh_success', `cloudflared tunnel cleanup for tunnel ${tunnelId} successful. STDOUT: ${cleanupStdout}`);
  }

  // 3. Uninstall the cloudflared service
  const uninstallCommand = `sudo cloudflared service uninstall`;
  const { stdout: uninstallStdout, stderr: uninstallStderr, code: uninstallCode } = await executeSshCommand(serverDetails, uninstallCommand);

  if (uninstallCode !== 0) {
    await logApiCall(userId, 'cloudflared_service_uninstall_ssh_failed', `Failed to uninstall cloudflared service for tunnel ${tunnelId} on ${serverDetails.ip_address}. STDERR: ${uninstallStderr}`);
    throw new Error(`Error uninstalling cloudflared service via SSH: ${uninstallStderr}`);
  }
  await logApiCall(userId, 'cloudflared_service_uninstall_ssh_success', `Cloudflared service uninstalled successfully for tunnel ${tunnelId} on ${serverDetails.ip_address}. STDOUT: ${uninstallStdout}`);

  // 4. Remove credentials file (if it exists)
  await executeSshCommand(serverDetails, `rm -f /root/.cloudflared/${tunnelId}.json`).catch(e => console.warn(`[CloudflareUtils] Could not remove credentials file for tunnel ${tunnelId}: ${e.message}`));
  await logApiCall(userId, 'cloudflared_credentials_file_removed', `Credentials file for tunnel ${tunnelId} removed from ${serverDetails.ip_address}.`);
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