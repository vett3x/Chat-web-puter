export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';

const personalizationSchema = z.object({
  app_name: z.string().optional(),
  theme_primary_color: z.string().optional(),
  theme_sidebar_color: z.string().optional(),
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

export async function GET(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });

  try {
    const { data, error } = await supabaseAdmin
      .from('global_settings')
      .select('login_background_url, app_name, app_logo_url, theme_primary_color, theme_sidebar_color')
      .single();
    if (error) throw error;
    return NextResponse.json(data || {});
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });

  try {
    const formData = await req.formData();
    const loginBackgroundFile = formData.get('login_background') as File | null;
    const appLogoFile = formData.get('app_logo') as File | null;
    const settings = formData.get('settings');
    let parsedSettings = {};
    if (typeof settings === 'string') {
      parsedSettings = personalizationSchema.parse(JSON.parse(settings));
    }

    let login_background_url: string | undefined = undefined;
    let app_logo_url: string | undefined = undefined;

    if (loginBackgroundFile) {
      const filePath = `public/login-background-${Date.now()}-${loginBackgroundFile.name}`;
      const { error } = await supabaseAdmin.storage.from('app_assets').upload(filePath, loginBackgroundFile, { upsert: true });
      if (error) throw error;
      login_background_url = supabaseAdmin.storage.from('app_assets').getPublicUrl(filePath).data.publicUrl;
    }

    if (appLogoFile) {
      const filePath = `public/app-logo-${Date.now()}-${appLogoFile.name}`;
      const { error } = await supabaseAdmin.storage.from('app_assets').upload(filePath, appLogoFile, { upsert: true });
      if (error) throw error;
      app_logo_url = supabaseAdmin.storage.from('app_assets').getPublicUrl(filePath).data.publicUrl;
    }

    const updateData = {
      ...parsedSettings,
      ...(login_background_url && { login_background_url }),
      ...(app_logo_url && { app_logo_url }),
    };

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('global_settings')
        .update(updateData)
        .eq('id', '00000000-0000-0000-0000-000000000000');
      if (updateError) throw updateError;
    }

    return NextResponse.json({ message: 'Configuración de personalización actualizada.' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const assetType = searchParams.get('type'); // 'login_background' or 'app_logo'

  if (!assetType || (assetType !== 'login_background' && assetType !== 'app_logo')) {
    return NextResponse.json({ message: 'Tipo de recurso no válido.' }, { status: 400 });
  }

  const urlColumn = assetType === 'login_background' ? 'login_background_url' : 'app_logo_url';

  try {
    const { data: currentSettings, error: fetchError } = await supabaseAdmin.from('global_settings').select('login_background_url, app_logo_url').single();
    if (fetchError) throw fetchError;

    const currentUrl = currentSettings?.[urlColumn];
    if (currentUrl) {
      const urlParts = currentUrl.split('/');
      const filePath = urlParts.slice(urlParts.indexOf('public')).join('/');
      await supabaseAdmin.storage.from('app_assets').remove([filePath]);
    }

    await supabaseAdmin.from('global_settings').update({ [urlColumn]: null }).eq('id', '00000000-0000-0000-0000-000000000000');

    return NextResponse.json({ message: 'Recurso eliminado.' });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}