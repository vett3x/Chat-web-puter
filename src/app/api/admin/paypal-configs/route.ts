export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';

const configSchema = z.object({
  id: z.string().uuid().optional(),
  nickname: z.string().min(1, 'El apodo es requerido.'),
  client_id: z.string().min(1, 'El Client ID es requerido.'),
  client_secret: z.string().optional(),
  is_active: z.boolean().optional(),
  mode: z.enum(['sandbox', 'live']).default('sandbox'),
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
      .from('paypal_configs')
      .select('id, nickname, is_active, status, last_tested_at, created_at, mode')
      .order('created_at', { ascending: true });

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
    const body = await req.json();
    const config = configSchema.parse(body);

    if (!config.client_secret) {
      return NextResponse.json({ message: 'El Client Secret es requerido.' }, { status: 400 });
    }

    if (config.is_active) {
      await supabaseAdmin.from('paypal_configs').update({ is_active: false }).eq('is_active', true);
    }

    const { data, error } = await supabaseAdmin
      .from('paypal_configs')
      .insert({
        ...config,
        client_id: config.client_id,
        client_secret: config.client_secret,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ message: 'Configuración de PayPal guardada.' }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });

  try {
    const body = await req.json();
    const config = configSchema.parse(body);
    if (!config.id) return NextResponse.json({ message: 'Se requiere un ID para actualizar.' }, { status: 400 });

    const updateData: any = { ...config, updated_at: new Date().toISOString() };
    delete updateData.id;

    if (config.client_id) updateData.client_id = config.client_id;
    if (config.client_secret) updateData.client_secret = config.client_secret;
    else delete updateData.client_secret;

    if (config.is_active) {
      await supabaseAdmin.from('paypal_configs').update({ is_active: false }).eq('is_active', true).neq('id', config.id);
    }

    const { error } = await supabaseAdmin.from('paypal_configs').update(updateData).eq('id', config.id);
    if (error) throw error;

    return NextResponse.json({ message: 'Configuración actualizada.' });
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ message: 'ID no proporcionado.' }, { status: 400 });

  const { error } = await supabaseAdmin.from('paypal_configs').delete().eq('id', id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ message: 'Configuración eliminada.' });
}