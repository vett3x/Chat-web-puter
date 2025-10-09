export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

async function getUserId() {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Acceso denegado.');
  return session.user.id;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const noteId = params.id;
  try {
    const userId = await getUserId();
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data, error } = await supabaseAdmin
      .from('notes')
      .select('id, title, content, updated_at, chat_history')
      .eq('id', noteId)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`[API /notes/${noteId}] GET Error:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const noteId = params.id;
  try {
    const userId = await getUserId();
    const body = await req.json();
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { error } = await supabaseAdmin
      .from('notes')
      .update(body)
      .eq('id', noteId)
      .eq('user_id', userId);

    if (error) throw error;
    return NextResponse.json({ message: 'Nota guardada.' });
  } catch (error: any) {
    console.error(`[API /notes/${noteId}] PUT Error:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}