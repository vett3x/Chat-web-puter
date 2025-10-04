export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import CryptoJS from 'crypto-js';

const configSchema = z.object({
  id: z.string().uuid().optional(),
  nickname: z.string().min(1, 'El apodo es requerido.').optional(),
  endpoint: z.string().url('Debe ser una URL válida.').optional(),
  bucket_name: z.string().min(1, 'El nombre del bucket es requerido.').optional(),
  region: z.string().min(1, 'La región es requerida.').optional(),
  access_key_id: z.string().min(1, 'El Access Key ID es requerido.').optional(),
  secret_access_key: z.string().optional(),
  is_active: z.boolean().optional(),
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
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

export async function GET(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });

  try {
    const { data, error } = await supabaseAdmin
      .from('s3_storage_configs')
      .select('id, nickname, endpoint, bucket_name, region, access_key_id, is_active, status, last_tested_at, created_at')
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
  if (!ENCRYPTION_KEY) return NextResponse.json({ message: 'La clave de encriptación no está configurada en el servidor.' }, { status: 500 });

  try {
    const body = await req.json();
    const config = configSchema.parse(body);

    if (!config.secret_access_key) {
      return NextResponse.json({ message: 'La clave secreta es requerida.' }, { status: 400 });
    }

    if (config.is_active) {
      await supabaseAdmin.from('s3_storage_configs').update({ is_active: false }).eq('is_active', true);
    }

    const { data, error } = await supabaseAdmin
      .from('s3_storage_configs')
      .insert({
        ...config,
        access_key_id: CryptoJS.AES.encrypt(config.access_key_id!, ENCRYPTION_KEY).toString(),
        secret_access_key: CryptoJS.AES.encrypt(config.secret_access_key, ENCRYPTION_KEY).toString(),
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ message: 'Configuración S3 guardada.' }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  if (!ENCRYPTION_KEY) return NextResponse.json({ message: 'La clave de encriptación no está configurada en el servidor.' }, { status: 500 });

  try {
    const body = await req.json();
    const config = configSchema.parse(body);
    if (!config.id) return NextResponse.json({ message: 'Se requiere un ID para actualizar.' }, { status: 400 });

    const updateData: any = { ...config, updated_at: new Date().toISOString() };
    delete updateData.id;

    if (config.access_key_id) updateData.access_key_id = CryptoJS.AES.encrypt(config.access_key_id, ENCRYPTION_KEY).toString();
    if (config.secret_access_key) updateData.secret_access_key = CryptoJS.AES.encrypt(config.secret_access_key, ENCRYPTION_KEY).toString();
    else delete updateData.secret_access_key;

    if (config.is_active) {
      await supabaseAdmin.from('s3_storage_configs').update({ is_active: false }).eq('is_active', true).neq('id', config.id);
    }

    const { error } = await supabaseAdmin.from('s3_storage_configs').update(updateData).eq('id', config.id);
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

  const { error } = await supabaseAdmin.from('s3_storage_configs').delete().eq('id', id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ message: 'Configuración eliminada.' });
}