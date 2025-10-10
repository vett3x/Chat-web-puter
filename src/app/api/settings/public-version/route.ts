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
      .select('app_version, app_build_number')
      .single();

    if (error) {
      console.error('[API /public-version] Error fetching version:', error);
      return NextResponse.json({ 
        app_version: 'N/A',
        app_build_number: 'N/A',
      });
    }

    return NextResponse.json({ 
      app_version: data?.app_version || 'N/A',
      app_build_number: data?.app_build_number || 'N/A',
    });
  } catch (error: any) {
    console.error('[API /public-version] Critical error:', error);
    return NextResponse.json({ 
      app_version: 'Error',
      app_build_number: 'Error',
    }, { status: 500 });
  }
}