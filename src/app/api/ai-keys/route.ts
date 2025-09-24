export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

const apiKeySchema = z.object({
  provider: z.string().min(1),
  api_key: z.string().min(1),
  nickname: z.string().optional(),
});

async function getSupabaseClient() {
  const cookieStore = cookies() as any;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
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
    .select('id, provider, api_key, is_active, created_at, nickname')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  // Mask the API keys before sending them to the client
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
    const { provider, api_key, nickname } = apiKeySchema.parse(body);

    const { data, error } = await supabase
      .from('user_api_keys')
      .insert({
        user_id: session.user.id,
        provider,
        api_key,
        nickname,
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