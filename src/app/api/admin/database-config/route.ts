export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { encrypt, decrypt } from '@/lib/encryption';

const configSchema = z.object({
  id: z.string().uuid().optional(),
  nickname: z.string().min(1, 'El apodo es requerido.'),
  is_active: z.boolean().optional(),
  db_host: z.string().min(1),
  db_port: z.coerce.number().int().min(1),
  db_name: z.string().min(1),
  db_user: z.string().min(1),
  db_password: z.string().optional(), // Optional for updates
});

async function getIsSuperAdmin(): Promise<boolean> {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
      },
    }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  return profile?.role === 'super_admin';
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('database_config')
      .select('id, nickname, is_active, db_host, db_port, db_name, db_user, created_at') // Exclude password
      .order('created_at', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const config = configSchema.parse(body);

    if (!config.db_password) {
      return NextResponse.json({ message: 'La contraseña es requerida para crear una nueva configuración.' }, { status: 400 });
    }

    const encryptedPassword = encrypt(config.db_password);

    // Transaction to ensure only one is active
    if (config.is_active) {
      const { error: updateError } = await supabaseAdmin
        .from('database_config')
        .update({ is_active: false })
        .eq('is_active', true);
      if (updateError) throw updateError;
    }

    const { data, error } = await supabaseAdmin
      .from('database_config')
      .insert({
        nickname: config.nickname,
        is_active: config.is_active,
        db_host: config.db_host,
        db_port: config.db_port,
        db_name: config.db_name,
        db_user: config.db_user,
        db_password: encryptedPassword,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ message: 'Configuración de base de datos guardada.' }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const config = configSchema.parse(body);

    if (!config.id) {
      return NextResponse.json({ message: 'Se requiere un ID para actualizar.' }, { status: 400 });
    }

    const updateData: any = {
      nickname: config.nickname,
      is_active: config.is_active,
      db_host: config.db_host,
      db_port: config.db_port,
      db_name: config.db_name,
      db_user: config.db_user,
      updated_at: new Date().toISOString(),
    };

    if (config.db_password) {
      updateData.db_password = encrypt(config.db_password);
    }

    // Transaction to ensure only one is active
    if (config.is_active) {
      const { error: updateError } = await supabaseAdmin
        .from('database_config')
        .update({ is_active: false })
        .eq('is_active', true)
        .neq('id', config.id); // Don't deactivate the one we are about to activate
      if (updateError) throw updateError;
    }

    const { data, error } = await supabaseAdmin
      .from('database_config')
      .update(updateData)
      .eq('id', config.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ message: 'Configuración actualizada.' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'ID de configuración no proporcionado.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('database_config')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Configuración eliminada.' });
}