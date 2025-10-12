export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';

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
      .from('technology_logos')
      .select('*')
      .order('order_index', { ascending: true });
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });

  try {
    const formData = await req.formData();
    const name = formData.get('name') as string;
    const logoFile = formData.get('logo_file') as File | null;
    const orderIndex = formData.get('order_index') as string;

    if (!name || !logoFile) {
      return NextResponse.json({ message: 'El nombre y el archivo del logo son requeridos.' }, { status: 400 });
    }

    const filePath = `public/logos/${Date.now()}-${logoFile.name}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('app_assets')
      .upload(filePath, logoFile);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseAdmin.storage.from('app_assets').getPublicUrl(filePath);

    const { error: insertError } = await supabaseAdmin
      .from('technology_logos')
      .insert({ name, logo_url: publicUrl, order_index: parseInt(orderIndex, 10) || 0 });

    if (insertError) throw insertError;

    return NextResponse.json({ message: 'Logo añadido correctamente.' }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ message: 'ID no proporcionado.' }, { status: 400 });

  try {
    const { data: logo, error: fetchError } = await supabaseAdmin
      .from('technology_logos')
      .select('logo_url')
      .eq('id', id)
      .single();

    if (fetchError || !logo) throw new Error('Logo no encontrado.');

    const urlParts = logo.logo_url.split('/');
    const filePath = urlParts.slice(urlParts.indexOf('public')).join('/');
    await supabaseAdmin.storage.from('app_assets').remove([filePath]);

    const { error: deleteError } = await supabaseAdmin.from('technology_logos').delete().eq('id', id);
    if (deleteError) throw deleteError;

    return NextResponse.json({ message: 'Logo eliminado correctamente.' });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}