export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

const apiKeySchema = z.object({
  provider: z.string().min(1),
  api_key: z.string().min(1),
  nickname: z.string().optional(),
  api_endpoint: z.string().url().optional(),
  model_name: z.string().min(1).optional(),
});

const updateApiKeySchema = z.object({
  id: z.string().uuid().optional(), // Optional for update by provider
  provider: z.string().min(1),
  api_key: z.string().min(10).optional(),
  nickname: z.string().optional(),
  api_endpoint: z.string().url().optional(),
  model_name: z.string().min(1).optional(),
});

async function getSupabaseClient() {
  const cookieStore = cookies() as any;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {},
        remove: (name: string, options: CookieOptions) => {},
      },
    }
  );
}

export async function GET(req: NextRequest) {
  const supabase = await getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('user_api_keys')
    .select('id, provider, api_key, is_active, created_at, nickname, api_endpoint, model_name')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const maskedData = data.map(key => ({
    ...key,
    api_key: `${key.api_key.substring(0, 4)}...${key.api_key.substring(key.api_key.length - 4)}`,
  }));

  return NextResponse.json(maskedData);
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const payload = apiKeySchema.parse(body);

    const { data, error } = await supabase
      .from('user_api_keys')
      .insert({
        user_id: session.user.id,
        ...payload,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ message: 'API Key guardada correctamente.', key: data }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const supabase = await getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { provider, ...updateData } = updateApiKeySchema.parse(body);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: 'No se proporcionaron datos para actualizar.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('user_api_keys')
      .update(updateData)
      .eq('user_id', session.user.id)
      .eq('provider', provider)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ message: 'API Key actualizada correctamente.', key: data });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'ID de la clave no proporcionado.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('user_api_keys')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'API Key eliminada correctamente.' });
}