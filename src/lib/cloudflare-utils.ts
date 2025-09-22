import { z } from 'zod';
import { randomBytes } from 'crypto';

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
}

// Función genérica para llamar a la API de Cloudflare
async function callCloudflareApi<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  options: CloudflareApiOptions,
  body?: any
): Promise<T> {
  const { apiToken, zoneId } = options;
  const baseUrl = 'https://api.cloudflare.com/client/v4';
  let url = `${baseUrl}${path}`;

  // --- DEBUGGING LOG ---
  console.log(`[Cloudflare API Call]
    - Method: ${method}
    - URL: ${url}
    - API Token (first 8 chars): ${apiToken.substring(0, 8)}...`);
  // --- END DEBUGGING LOG ---

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
  
  // Check if the response has a body before trying to parse it
  const responseText = await response.text();
  if (!responseText) {
    if (response.ok) {
      // If the request was successful but the body is empty,
      // we need to decide how to handle it. For DELETE, this is fine.
      // For POST/GET that expect data, this is an error.
      if (method === 'DELETE') {
        return {} as T; // Return an empty object for successful deletions
      }
      throw new Error('La API de Cloudflare devolvió una respuesta vacía cuando se esperaban datos.');
    } else {
      throw new Error(`La API de Cloudflare falló con el estado ${response.status} y una respuesta vacía.`);
    }
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    console.error("Failed to parse Cloudflare API response as JSON:", responseText);
    throw new Error("La respuesta de la API de Cloudflare no es un JSON válido.");
  }

  const parsedData = cloudflareApiResponseSchema.safeParse(data);

  if (!parsedData.success) {
    console.error('Cloudflare API response validation error:', parsedData.error);
    throw new Error('Error de validación de la respuesta de la API de Cloudflare.');
  }

  if (!parsedData.data.success) {
    const errorMessages = parsedData.data.errors?.map(e => `(Code: ${e.code}) ${e.message}`).join('; ') || 'Error desconocido de Cloudflare API.';
    console.error('Cloudflare API error:', parsedData.data.errors);
    throw new Error(`Error de Cloudflare API: ${errorMessages}`);
  }

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
  tunnelName: string
): Promise<CloudflareDashboardTunnel> {
  const path = `/accounts/${accountId}/tunnels`;
  const body = { name: tunnelName, config_src: "cloudflare" }; // Use config_src for dashboard tunnels
  return callCloudflareApi<CloudflareDashboardTunnel>('POST', path, { apiToken }, body);
}

// New function to get the tunnel token
export async function getCloudflareTunnelToken(
  apiToken: string,
  accountId: string,
  tunnelId: string
): Promise<string> {
  const path = `/accounts/${accountId}/tunnels/${tunnelId}/token`;
  // The result is directly the token string
  return callCloudflareApi<string>('GET', path, { apiToken });
}

export async function configureCloudflareTunnelIngress(
  apiToken: string,
  accountId: string,
  tunnelId: string,
  hostname: string,
  hostPort: number
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
  await callCloudflareApi<void>('PUT', path, { apiToken }, body);
}

export async function deleteCloudflareTunnel(
  apiToken: string,
  accountId: string,
  tunnelId: string
): Promise<void> {
  // The endpoint for dashboard tunnels is different
  const path = `/accounts/${accountId}/tunnels/${tunnelId}`;
  await callCloudflareApi<void>('DELETE', path, { apiToken });
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
  return callCloudflareApi<CloudflareDnsRecord>('POST', path, { apiToken, zoneId }, body);
}

export async function deleteCloudflareDnsRecord(
  apiToken: string,
  zoneId: string,
  recordId: string
): Promise<void> {
  const path = `/zones/${zoneId}/dns_records/${recordId}`;
  await callCloudflareApi<void>('DELETE', path, { apiToken, zoneId });
}