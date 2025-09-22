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
  containerPort: number, // Changed from serviceUrl to containerPort
  userId?: string,
): Promise<void> {
  const path = `/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`;
  const body = {
    config: {
      ingress: [
        {
          hostname: fullDomain,
          service: `http://localhost:${containerPort}`, // CHANGED TO HTTP
          originRequest: {
            noTLSVerify: true,
          },
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
 * Installs and runs the cloudflared client inside a Docker container via SSH.
 * This function now operates on the container, not the host.
 */
export async function installAndRunCloudflaredService(
  serverDetails: ServerDetails,
  containerId: string, // NEW: containerId to exec into
  tunnelId: string,
  tunnelToken: string,
  fullDomain: string, // NEW: fullDomain for ingress config
  containerPort: number, // NEW: containerPort for ingress config
  userId?: string,
): Promise<void> {
  await logApiCall(userId, 'cloudflared_container_install_run_ssh', `Attempting to install and run cloudflared inside container ${containerId.substring(0,12)} on ${serverDetails.ip_address}.`);

  const cloudflaredDir = `/root/.cloudflared`;
  const credentialsFilePath = `${cloudflaredDir}/${tunnelId}.json`;
  const configFilePath = `${cloudflaredDir}/config.yml`; // Changed config file path

  // 1. Ensure .cloudflared directory exists inside the container
  await executeSshCommand(serverDetails, `docker exec ${containerId} mkdir -p ${cloudflaredDir}`);
  await logApiCall(userId, 'cloudflared_container_mkdir', `Ensured ${cloudflaredDir} directory exists inside container ${containerId.substring(0,12)}.`);

  // 2. Write credentials file inside the container using Base64
  const credentialsFileContent = JSON.stringify({ TunnelSecret: tunnelToken, TunnelID: tunnelId });
  const encodedCredentials = Buffer.from(credentialsFileContent).toString('base64');
  const writeCredentialsCommand = `echo '${encodedCredentials}' | base64 -d > ${credentialsFilePath}`;
  await executeSshCommand(serverDetails, `docker exec ${containerId} sh -c "${writeCredentialsCommand}"`);
  await logApiCall(userId, 'cloudflared_container_credentials_written', `Credentials file written inside container ${containerId.substring(0,12)}.`);

  // 3. Write config.yml file inside the container using Base64
  const configContent = `
tunnel: ${tunnelId}
credentials-file: ${credentialsFilePath}
ingress:
  - hostname: ${fullDomain}
    service: http://localhost:${containerPort}
    originRequest:
      noTLSVerify: true
  - service: http_status:404
`; // ADDED originRequest with noTLSVerify
  const encodedConfig = Buffer.from(configContent).toString('base64');
  const writeConfigCommand = `echo '${encodedConfig}' | base64 -d > ${configFilePath}`;
  await executeSshCommand(serverDetails, `docker exec ${containerId} sh -c "${writeConfigCommand}"`);
  await logApiCall(userId, 'cloudflared_container_config_written', `Config.yml written inside container ${containerId.substring(0,12)}.`);

  // 4. Run cloudflared tunnel in detached mode inside the container
  // We use `nohup` and `&` to run it in the background and prevent it from dying if the SSH session closes.
  const runCommand = `nohup cloudflared tunnel run ${tunnelId} --config ${configFilePath} > /dev/null 2>&1 &`;
  const { stdout, stderr, code } = await executeSshCommand(serverDetails, `docker exec ${containerId} bash -c "${runCommand}"`); // Use bash -c for nohup

  if (code !== 0) {
    await logApiCall(userId, 'cloudflared_container_run_failed', `Failed to run cloudflared inside container ${containerId.substring(0,12)}. STDERR: ${stderr}`);
    throw new Error(`Error running cloudflared inside container via SSH: ${stderr}`);
  }
  await logApiCall(userId, 'cloudflared_container_run_success', `Cloudflared client running successfully inside container ${containerId.substring(0,12)}. STDOUT: ${stdout}`);
}

/**
 * Uninstalls the cloudflared client from inside a Docker container via SSH.
 * This function now operates on the container, not the host.
 */
export async function uninstallCloudflaredService(
  serverDetails: ServerDetails,
  containerId: string, // NEW: containerId to exec into
  tunnelId: string, // NEW: tunnelId for cleanup and file removal
  fullDomain: string, // NEW: Added for consistency, not directly used in uninstall logic
  containerPort: number, // NEW: Added for consistency, not directly used in uninstall logic
  userId?: string,
): Promise<void> {
  await logApiCall(userId, 'cloudflared_container_uninstall_ssh', `Attempting to uninstall cloudflared from inside container ${containerId.substring(0,12)} on ${serverDetails.ip_address}.`);

  const cloudflaredDir = `/root/.cloudflared`;
  const credentialsFilePath = `${cloudflaredDir}/${tunnelId}.json`;
  const configFilePath = `${cloudflaredDir}/config.yml`;

  // 1. Find and kill the cloudflared process inside the container
  await logApiCall(userId, 'cloudflared_container_kill_process', `Killing cloudflared process inside container ${containerId.substring(0,12)}.`);
  // Use `pkill` to gracefully terminate the cloudflared process
  await executeSshCommand(serverDetails, `docker exec ${containerId} pkill cloudflared`).catch(e => console.warn(`[CloudflareUtils] Could not kill cloudflared process cleanly in container ${containerId.substring(0,12)}: ${e.message}`));

  // 2. Remove config.yml and credentials file from inside the container
  await executeSshCommand(serverDetails, `docker exec ${containerId} rm -f ${configFilePath}`).catch(e => console.warn(`[CloudflareUtils] Could not remove config.yml from container ${containerId.substring(0,12)}: ${e.message}`));
  await executeSshCommand(serverDetails, `docker exec ${containerId} rm -f ${credentialsFilePath}`).catch(e => console.warn(`[CloudflareUtils] Could not remove credentials file from container ${containerId.substring(0,12)}: ${e.message}`));
  await executeSshCommand(serverDetails, `docker exec ${containerId} rm -f ${cloudflaredDir}/cert.pem`).catch(e => console.warn(`[CloudflareUtils] Could not remove cert.pem from container ${containerId.substring(0,12)}: ${e.message}`)); // Remove cert.pem if it was created

  await logApiCall(userId, 'cloudflared_container_files_removed', `Cloudflared config and credentials files removed from container ${containerId.substring(0,12)}.`);

  // Note: We don't "uninstall" cloudflared from the container's OS,
  // as it was installed via apt-get. We just stop its execution and remove its config.
  await logApiCall(userId, 'cloudflared_container_uninstall_success', `Cloudflared client stopped and cleaned up from container ${containerId.substring(0,12)}.`);
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