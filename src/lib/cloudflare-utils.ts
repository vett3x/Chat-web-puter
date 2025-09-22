import { z } from 'zod';
import { randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';

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
    throw new Error('Error de validación de la respuesta de la API de Cloudflare.');
  }

  if (!parsedData.data.success) {
    const errorMessages = parsedData.data.errors?.map(e => `(Code: ${e.code}) ${e.message}`).join('; ') || 'Error desconocido de Cloudflare API.';
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

// --- Tunnel Management ---

interface CloudflareDashboardTunnel {
  id: string;
  name: string;
  // No secret is returned for dashboard-managed tunnels
}

// This function now creates a dashboard-managed tunnel
export async function createCloudflareTunnel(
  apiToken: string,
  accountId: string,
  tunnelName: string,
  userId?: string,
): Promise<CloudflareDashboardTunnel> {
  const path = `/accounts/${accountId}/tunnels`;
  const body = { name: tunnelName, config_src: "cloudflare" }; // Use config_src for dashboard tunnels
  return callCloudflareApi<CloudflareDashboardTunnel>('POST', path, { apiToken, userId }, body);
}

// New function to get the tunnel token
export async function getCloudflareTunnelToken(
  apiToken: string,
  accountId: string,
  tunnelId: string,
  userId?: string,
): Promise<string> {
  const path = `/accounts/${accountId}/tunnels/${tunnelId}/token`;
  // The result is directly the token string
  return callCloudflareApi<string>('GET', path, { apiToken, userId });
}

export async function configureCloudflareTunnelIngress(
  apiToken: string,
  accountId: string,
  tunnelId: string,
  hostname: string,
  hostPort: number,
  userId?: string,
): Promise<void> {
  const path = `/accounts/${accountId}/tunnels/${tunnelId}/configurations`;
  const body = {
    config: {
      ingress: [
        {
          hostname: hostname,
          service: `http://localhost:${hostPort}`,
        },
        {
          service: 'http_status:404', // Catch-all
        },
      ],
    },
  };
  await callCloudflareApi<void>('PUT', path, { apiToken, userId }, body);
}

export async function deleteCloudflareTunnel(
  apiToken: string,
  accountId: string,
  tunnelId: string,
  userId?: string,
): Promise<void> {
  // The endpoint for dashboard tunnels is different
  const path = `/accounts/${accountId}/tunnels/${tunnelId}`;
  await callCloudflareApi<void>('DELETE', path, { apiToken, userId });
}

// --- DNS Record Management ---

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