export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Este endpoint es público y no requiere autenticación.
// Se utiliza un cliente de administrador para consultar la configuración global.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('global_settings')
      .select('maintenance_mode_enabled, users_disabled, admins_disabled')
      .single();

    if (error) {
      console.error('[API /public-status] Error fetching settings, defaulting to false:', error);
      return NextResponse.json({ 
        maintenanceModeEnabled: false,
        usersDisabled: false,
        adminsDisabled: false,
      });
    }

    return NextResponse.json({ 
      maintenanceModeEnabled: data?.maintenance_mode_enabled ?? false,
      usersDisabled: data?.users_disabled ?? false,
      adminsDisabled: data?.admins_disabled ?? false,
    });
  } catch (error: any) {
    console.error('[API /public-status] Critical error:', error);
    return NextResponse.json({ 
      maintenanceModeEnabled: false,
      usersDisabled: false,
      adminsDisabled: false,
    }, { status: 500 });
  }
}