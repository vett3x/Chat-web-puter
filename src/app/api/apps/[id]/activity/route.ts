export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function getUserId() {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { get: (name: string) => cookieStore.get(name)?.value } });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Acceso denegado.');
  return session.user.id;
}

export async function GET(req: NextRequest, context: any) {
  const appId = context.params.id;

  try {
    const userId = await getUserId();

    // First, get the app details to find the server_id and container_id
    const { data: app, error: appError } = await supabaseAdmin
      .from('user_apps')
      .select('server_id, container_id')
      .eq('id', appId)
      .eq('user_id', userId)
      .single();

    if (appError || !app) {
      throw new Error('Aplicación no encontrada o acceso denegado.');
    }

    if (!app.server_id || !app.container_id) {
      return NextResponse.json([]); // Return empty if no server/container is associated yet
    }

    const shortContainerId = app.container_id.substring(0, 12);

    // Fetch events related to the server and filter by container ID in the description
    const { data: events, error: fetchError } = await supabaseAdmin
      .from('server_events_log')
      .select('id, event_type, description, created_at')
      .eq('server_id', app.server_id)
      .like('description', `%${shortContainerId}%`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (fetchError) {
      console.error(`Error fetching activity for app ${appId}:`, fetchError);
      throw new Error('Error al cargar el historial de actividad de la aplicación.');
    }

    return NextResponse.json(events);
  } catch (error: any) {
    console.error(`[API ACTIVITY /apps/${appId}] Error:`, error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}