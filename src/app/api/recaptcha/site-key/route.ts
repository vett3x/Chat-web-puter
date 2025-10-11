export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('auth_configs')
      .select('client_id')
      .eq('provider', 'recaptcha')
      .single();

    if (error || !data?.client_id) {
      console.warn('[API reCAPTCHA] Site key not found or error fetching it.');
      return NextResponse.json({ siteKey: null });
    }

    return NextResponse.json({ siteKey: data.client_id });
  } catch (error: any) {
    console.error('[API reCAPTCHA] Critical error:', error);
    return NextResponse.json({ message: 'Error interno del servidor.' }, { status: 500 });
  }
}