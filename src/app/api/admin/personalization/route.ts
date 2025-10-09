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

export async function GET(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });

  try {
    const { data, error } = await supabaseAdmin
      .from('global_settings')
      .select('login_background_url')
      .single();
    if (error) throw error;
    return NextResponse.json({ login_background_url: data?.login_background_url || null });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });

  try {
    const formData = await req.formData();
    const file = formData.get('login_background') as File | null;
    if (!file) throw new Error('No se ha subido ningún archivo.');

    const filePath = `public/login-background-${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('app_assets')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseAdmin.storage.from('app_assets').getPublicUrl(filePath);

    const { error: updateError } = await supabaseAdmin
      .from('global_settings')
      .update({ login_background_url: publicUrl })
      .eq('id', '00000000-0000-0000-0000-000000000000');
    if (updateError) throw updateError;

    return NextResponse.json({ message: 'Fondo de inicio de sesión actualizado.', url: publicUrl });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });

  try {
    const { data: currentSettings, error: fetchError } = await supabaseAdmin
      .from('global_settings')
      .select('login_background_url')
      .single();
    if (fetchError) throw fetchError;

    if (currentSettings?.login_background_url) {
      const urlParts = currentSettings.login_background_url.split('/');
      const filePath = urlParts.slice(urlParts.indexOf('public')).join('/');
      const { error: deleteError } = await supabaseAdmin.storage.from('app_assets').remove([filePath]);
      if (deleteError) console.warn(`Failed to delete old background from storage: ${deleteError.message}`);
    }

    const { error: updateError } = await supabaseAdmin
      .from('global_settings')
      .update({ login_background_url: null })
      .eq('id', '00000000-0000-0000-0000-000000000000');
    if (updateError) throw updateError;

    return NextResponse.json({ message: 'Fondo de inicio de sesión eliminado.' });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}