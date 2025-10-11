export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

async function getIsSuperAdmin(): Promise<boolean> {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
  return profile?.role === 'super_admin';
}

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ message: 'ID de configuración no proporcionado.' }, { status: 400 });

  try {
    const { data: config, error: fetchError } = await supabaseAdmin
      .from('paypal_configs')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !config) throw new Error('Configuración no encontrada.');

    const clientId = config.client_id;
    const clientSecret = config.client_secret;

    if (!clientId || !clientSecret) {
      throw new Error('Las credenciales de PayPal no están completas en la base de datos.');
    }

    const PAYPAL_API_URL = config.mode === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
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

    await supabaseAdmin.from('paypal_configs').update({ status: 'verified', last_tested_at: new Date().toISOString() }).eq('id', id);

    return NextResponse.json({ message: 'Conexión con PayPal exitosa.' });
  } catch (error: any) {
    await supabaseAdmin.from('paypal_configs').update({ status: 'failed', last_tested_at: new Date().toISOString() }).eq('id', id);
    console.error('[PayPal Test Connection] Error:', error);
    return NextResponse.json({ message: `Falló la prueba de conexión: ${error.message}` }, { status: 400 });
  }
}