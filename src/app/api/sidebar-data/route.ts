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

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const [appsRes, convRes, folderRes, notesRes] = await Promise.all([
      supabaseAdmin.from('user_apps').select('id, name, status, url, conversation_id').eq('user_id', userId).order('created_at', { ascending: false }),
      supabaseAdmin.from('conversations').select('id, title, created_at, folder_id, order_index').eq('user_id', userId).order('order_index', { ascending: true }).order('created_at', { ascending: false }),
      supabaseAdmin.from('folders').select('id, name, parent_id, created_at, user_id').eq('user_id', userId).order('created_at', { ascending: false }),
      supabaseAdmin.from('notes').select('id, title, folder_id, created_at, updated_at').eq('user_id', userId).order('updated_at', { ascending: false })
    ]);

    if (appsRes.error) throw appsRes.error;
    if (convRes.error) throw convRes.error;
    if (folderRes.error) throw folderRes.error;
    if (notesRes.error) throw notesRes.error;

    const appConversationIds = new Set((appsRes.data || []).map(app => app.conversation_id));
    const apps = appsRes.data || [];
    const conversations = (convRes.data || []).filter(conv => !appConversationIds.has(conv.id));
    const folders = folderRes.data || [];
    const notes = notesRes.data || [];

    return NextResponse.json({ apps, conversations, folders, notes });

  } catch (error: any) {
    console.error('[API /sidebar-data] Error:', error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}