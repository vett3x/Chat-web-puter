import { createClient } from '@supabase/supabase-js';
import CryptoJS from 'crypto-js';

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const PAYPAL_API_URL = 'https://api-m.sandbox.paypal.com'; // Cambiar a producción cuando esté listo

interface PayPalCredentials {
  clientId: string;
  clientSecret: string;
}

async function getPayPalCredentials(): Promise<PayPalCredentials> {
  if (!ENCRYPTION_KEY) {
    throw new Error('La clave de encriptación no está configurada en el servidor.');
  }

  const { data: config, error } = await supabaseAdmin
    .from('paypal_configs')
    .select('client_id, client_secret')
    .eq('is_active', true)
    .single();

  if (error || !config) {
    throw new Error('No se encontró una configuración de PayPal activa.');
  }

  const clientId = CryptoJS.AES.decrypt(config.client_id, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
  const clientSecret = CryptoJS.AES.decrypt(config.client_secret, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);

  if (!clientId || !clientSecret) {
    throw new Error('No se pudieron desencriptar las credenciales de PayPal.');
  }

  return { clientId, clientSecret };
}

export async function getPayPalAccessToken(): Promise<string> {
  const { clientId, clientSecret } = await getPayPalCredentials();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${auth}`,
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || 'Error al obtener el token de acceso de PayPal.');
  }

  return data.access_token;
}