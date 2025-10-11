import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface PayPalCredentials {
  clientId: string;
  clientSecret: string;
  mode: 'sandbox' | 'live';
}

async function getPayPalCredentials(): Promise<PayPalCredentials> {
  const { data: config, error } = await supabaseAdmin
    .from('paypal_configs')
    .select('client_id, client_secret, mode')
    .eq('is_active', true)
    .single();

  if (error || !config) {
    throw new Error('No se encontró una configuración de PayPal activa.');
  }

  const { client_id: clientId, client_secret: clientSecret, mode } = config;

  if (!clientId || !clientSecret) {
    throw new Error('Las credenciales de PayPal (Client ID o Client Secret) no están configuradas en la base de datos.');
  }

  return { clientId, clientSecret, mode: mode as 'sandbox' | 'live' };
}

function getPayPalApiUrl(mode: 'sandbox' | 'live'): string {
  return mode === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
}

export async function getPayPalAccessToken(): Promise<{ accessToken: string; mode: 'sandbox' | 'live' }> {
  const { clientId, clientSecret, mode } = await getPayPalCredentials();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const PAYPAL_API_URL = getPayPalApiUrl(mode);

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

  return { accessToken: data.access_token, mode };
}