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
      .select('maintenance_mode_enabled')
      .single();

    if (error) {
      // Si hay un error (ej. la fila no existe), asumimos que el mantenimiento está desactivado
      // para evitar bloquear el acceso a la aplicación por un error de configuración.
      console.error('[API /maintenance-status] Error fetching settings, defaulting to false:', error);
      return NextResponse.json({ maintenanceModeEnabled: false });
    }

    return NextResponse.json({ maintenanceModeEnabled: data?.maintenance_mode_enabled ?? false });
  } catch (error: any) {
    console.error('[API /maintenance-status] Critical error:', error);
    // En caso de un error crítico, también asumimos que el mantenimiento está desactivado.
    return NextResponse.json({ maintenanceModeEnabled: false }, { status: 500 });
  }
}