export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET() {
  try {
    const { data: config, error } = await supabaseAdmin
      .from('paypal_configs')
      .select('client_id')
      .eq('is_active', true)
      .single();

    if (error || !config) {
      throw new Error('No se encontró una configuración de PayPal activa.');
    }

    const clientId = config.client_id;

    if (!clientId) {
      throw new Error('El Client ID de PayPal no está configurado en la base de datos.');
    }

    return NextResponse.json({ clientId });
  } catch (error: any) {
    console.error('[API PayPal Client ID] Error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}