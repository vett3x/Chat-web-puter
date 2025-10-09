export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const MESSAGES_PER_PAGE = 30;

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
  const conversationId = params.id;
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '0', 10);

  try {
    const userId = await getUserId();
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Check if user has access to this conversation
    const { data: convDetails, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('id, title, model')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (convError || !convDetails) {
      return NextResponse.json({ message: 'Conversación no encontrada o acceso denegado.' }, { status: 404 });
    }

    const from = page * MESSAGES_PER_PAGE;
    const to = from + MESSAGES_PER_PAGE - 1;

    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('messages')
      .select('id, content, role, model, created_at, conversation_id, type, plan_approved, is_correction_plan, correction_approved')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (messagesError) throw messagesError;

    return NextResponse.json({ details: convDetails, messages: messages.reverse() });

  } catch (error: any) {
    console.error(`[API /conversations/${conversationId}] GET Error:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}