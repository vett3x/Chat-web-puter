export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';

const versionSchema = z.object({
  version: z.string().min(1, 'La versión es requerida.'),
  buildNumber: z.string().min(1, 'El número de compilación es requerido.'),
});

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

export async function PUT(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { version, buildNumber } = versionSchema.parse(body);

    const { error } = await supabaseAdmin
      .from('global_settings')
      .update({ 
        app_version: version,
        app_build_number: buildNumber,
        updated_at: new Date().toISOString(),
      })
      .eq('id', '00000000-0000-0000-0000-000000000000');

    if (error) throw error;

    return NextResponse.json({ message: 'Versión y compilación actualizadas.' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('global_settings')
      .select('app_version, app_build_number')
      .eq('id', '00000000-0000-0000-0000-000000000000') // Añadido el filtro por ID
      .single();

    if (error) throw error;

    return NextResponse.json({ 
      app_version: data?.app_version || 'N/A',
      app_build_number: data?.app_build_number || 'N/A',
    });
  } catch (error: any) {
    console.error('[API /admin/version] Error fetching version:', error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}