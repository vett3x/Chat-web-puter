export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('global_settings')
      .select('login_background_url')
      .single();

    if (error) {
      console.error('[API /public-branding] Error fetching settings, defaulting to null:', error);
      return NextResponse.json({ login_background_url: null });
    }

    return NextResponse.json({ login_background_url: data?.login_background_url || null });
  } catch (error: any) {
    console.error('[API /public-branding] Critical error:', error);
    return NextResponse.json({ login_background_url: null }, { status: 500 });
  }
}