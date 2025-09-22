import { z } from 'zod';

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

  if (zoneId && !path.includes(`/zones/${zoneId}`)) {
    // If zoneId is provided and not already in path, assume it's for a zone-specific endpoint
    // This logic might need refinement based on specific Cloudflare API endpoints used
    // For now, we'll assume paths will be constructed correctly by calling functions
  }

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
  const data = await response.json();

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

interface CloudflareTunnel {
  id: string;
  name: string;
  secret: string;
  connections: any[]; // Simplified
}

export async function createCloudflareTunnel(
  apiToken: string,
  accountId: string, // Cloudflare Account ID is needed for tunnel creation
  tunnelName: string
): Promise<CloudflareTunnel> {
  const path = `/accounts/${accountId}/cfd_tunnel`;
  const body = { name: tunnelName, tunnel_secret: generateRandomSubdomain(32) }; // Generate a random secret
  return callCloudflareApi<CloudflareTunnel>('POST', path, { apiToken }, body);
}

export async function deleteCloudflareTunnel(
  apiToken: string,
  accountId: string,
  tunnelId: string
): Promise<void> {
  const path = `/accounts/${accountId}/cfd_tunnel/${tunnelId}`;
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