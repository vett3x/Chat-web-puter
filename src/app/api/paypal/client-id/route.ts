export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import CryptoJS from 'crypto-js';

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

export async function GET() {
  try {
    if (!ENCRYPTION_KEY) {
      throw new Error('La clave de encriptación no está configurada en el servidor.');
    }

    const { data: config, error } = await supabaseAdmin
      .from('paypal_configs')
      .select('client_id')
      .eq('is_active', true)
      .single();

    if (error || !config) {
      throw new Error('No se encontró una configuración de PayPal activa.');
    }

    const clientId = CryptoJS.AES.decrypt(config.client_id, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);

    if (!clientId) {
      throw new Error('No se pudo desencriptar el Client ID de PayPal.');
    }

    return NextResponse.json({ clientId });
  } catch (error: any) {
    console.error('[API PayPal Client ID] Error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}