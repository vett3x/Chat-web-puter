export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function getUserId() {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { get: (name: string) => cookieStore.get(name)?.value } });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Acceso denegado.');
  return session.user.id;
}

export async function GET(req: NextRequest, context: any) {
  const appId = context.params.id;
  try {
    const userId = await getUserId();
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data: app, error: appError } = await supabaseAdmin
      .from('user_apps')
      .select('server_id, status')
      .eq('id', appId)
      .eq('user_id', userId)
      .single();

    if (appError || !app) {
      throw new Error('Aplicación no encontrada o acceso denegado.');
    }

    if (!app.server_id) {
      return NextResponse.json({ log: 'Esperando asignación de servidor...', status: app.status });
    }

    const { data: server, error: serverError } = await supabaseAdmin
      .from('user_servers')
      .select('provisioning_log')
      .eq('id', app.server_id)
      .single();
    
    if (serverError) {
      throw new Error('No se pudo cargar el log de aprovisionamiento del servidor.');
    }

    return NextResponse.json({ log: server.provisioning_log || '', status: app.status });

  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}