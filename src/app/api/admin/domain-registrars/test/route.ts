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
      .from('domain_registrars')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !config) throw new Error('Configuración no encontrada.');

    // This is a placeholder for the actual Dinahosting API call.
    // A real implementation would use fetch() to call an endpoint like 'account.getBalance'.
    // For now, we just simulate a successful connection if credentials exist.
    if (config.api_username && config.api_password) {
      await supabaseAdmin.from('domain_registrars').update({ status: 'verified', last_tested_at: new Date().toISOString() }).eq('id', id);
      return NextResponse.json({ message: 'Conexión con el registrador de dominios exitosa (simulada).' });
    } else {
      throw new Error('Credenciales de API incompletas.');
    }

  } catch (error: any) {
    await supabaseAdmin.from('domain_registrars').update({ status: 'failed', last_tested_at: new Date().toISOString() }).eq('id', id);
    console.error('[Domain Registrar Test] Error:', error);
    return NextResponse.json({ message: `Falló la prueba de conexión: ${error.message}` }, { status: 400 });
  }
}