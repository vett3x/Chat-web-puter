export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';

const personalizationSchema = z.object({
  app_name: z.string().optional(),
  app_tagline: z.string().optional(),
  app_welcome_title: z.string().optional(),
  app_welcome_description: z.string().optional(),
  theme_primary_color: z.string().optional(),
  theme_sidebar_color: z.string().optional(),
  theme_accent_color: z.string().optional(),
  theme_border_radius: z.coerce.number().min(0).max(1).optional(),
  default_ai_model: z.string().optional(),
  chat_bubble_background_color: z.string().optional(),
  chat_bubble_border_color: z.string().optional(),
  chat_bubble_blur: z.coerce.number().min(0).max(32).optional(),
  liquid_ether_opacity: z.coerce.number().min(0).max(1).optional(),
  login_background_url: z.string().url('Debe ser una URL válida.').optional().or(z.literal('')).or(z.literal(null)),
  register_background_url: z.string().url('Debe ser una URL válida.').optional().or(z.literal('')).or(z.literal(null)), // New field
});

type PersonalizationFormValues = z.infer<typeof personalizationSchema>;

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
      .select('login_background_url, register_background_url, app_name, app_logo_url, theme_primary_color, theme_sidebar_color, app_favicon_url, app_tagline, app_welcome_title, app_welcome_description, theme_accent_color, theme_border_radius, default_ai_model, chat_bubble_background_color, chat_bubble_border_color, chat_bubble_blur, liquid_ether_opacity')
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
    const registerBackgroundFile = formData.get('register_background') as File | null; // New file
    const appLogoFile = formData.get('app_logo') as File | null;
    const appFaviconFile = formData.get('app_favicon') as File | null;
    const settings = formData.get('settings');
    let parsedSettings: PersonalizationFormValues = {};
    if (typeof settings === 'string') {
      parsedSettings = personalizationSchema.parse(JSON.parse(settings));
    }

    let login_background_url: string | null | undefined = undefined;
    let register_background_url: string | null | undefined = undefined; // New URL variable
    let app_logo_url: string | null | undefined = undefined;
    let app_favicon_url: string | null | undefined = undefined;

    // Handle login background
    if (loginBackgroundFile) {
      const filePath = `public/login-background-${Date.now()}-${loginBackgroundFile.name}`;
      const { error } = await supabaseAdmin.storage.from('app_assets').upload(filePath, loginBackgroundFile, { upsert: true });
      if (error) throw error;
      login_background_url = supabaseAdmin.storage.from('app_assets').getPublicUrl(filePath).data.publicUrl;
    } else if (parsedSettings.login_background_url !== undefined) {
      login_background_url = parsedSettings.login_background_url === '' ? null : parsedSettings.login_background_url;
    }

    // Handle register background
    if (registerBackgroundFile) {
      const filePath = `public/register-background-${Date.now()}-${registerBackgroundFile.name}`;
      const { error } = await supabaseAdmin.storage.from('app_assets').upload(filePath, registerBackgroundFile, { upsert: true });
      if (error) throw error;
      register_background_url = supabaseAdmin.storage.from('app_assets').getPublicUrl(filePath).data.publicUrl;
    } else if (parsedSettings.register_background_url !== undefined) {
      register_background_url = parsedSettings.register_background_url === '' ? null : parsedSettings.register_background_url;
    }

    if (appLogoFile) {
      const filePath = `public/app-logo-${Date.now()}-${appLogoFile.name}`;
      const { error } = await supabaseAdmin.storage.from('app_assets').upload(filePath, appLogoFile, { upsert: true });
      if (error) throw error;
      app_logo_url = supabaseAdmin.storage.from('app_assets').getPublicUrl(filePath).data.publicUrl;
    }

    if (appFaviconFile) {
      const filePath = `public/app-favicon-${Date.now()}-${appFaviconFile.name}`;
      const { error } = await supabaseAdmin.storage.from('app_assets').upload(filePath, appFaviconFile, { upsert: true });
      if (error) throw error;
      app_favicon_url = supabaseAdmin.storage.from('app_assets').getPublicUrl(filePath).data.publicUrl;
    }

    const updateData: { [key: string]: any } = {
      ...parsedSettings,
      ...(login_background_url !== undefined && { login_background_url }),
      ...(register_background_url !== undefined && { register_background_url }), // Add to update data
      ...(app_logo_url !== undefined && { app_logo_url }),
      ...(app_favicon_url !== undefined && { app_favicon_url }),
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

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
  const assetType = searchParams.get('type');

  const validAssetTypes = ['login_background', 'register_background', 'app_logo', 'app_favicon'];
  if (!assetType || !validAssetTypes.includes(assetType)) {
    return NextResponse.json({ message: 'Tipo de recurso no válido.' }, { status: 400 });
  }

  const urlColumnMap = {
    'login_background': 'login_background_url',
    'register_background': 'register_background_url',
    'app_logo': 'app_logo_url',
    'app_favicon': 'app_favicon_url',
  };
  const urlColumn = urlColumnMap[assetType as keyof typeof urlColumnMap];

  try {
    const { data: currentSettings, error: fetchError } = await supabaseAdmin.from('global_settings').select('login_background_url, register_background_url, app_logo_url, app_favicon_url').single();
    if (fetchError) throw fetchError;

    const currentUrl = (currentSettings as any)?.[urlColumn];
    if (currentUrl && currentUrl.includes(supabaseAdmin.storage.from('app_assets').getPublicUrl('').data.publicUrl)) {
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