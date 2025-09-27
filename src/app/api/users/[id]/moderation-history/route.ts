export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

async function getSessionAndRole(): Promise<{ session: any; userRole: 'user' | 'admin' | 'super_admin' | null }> {
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
  if (!session) return { session: null, userRole: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  const userRole = profile?.role as 'user' | 'admin' | 'super_admin' | null;
  return { session, userRole };
}

export async function GET(req: NextRequest, context: any) {
  const { session, userRole } = await getSessionAndRole();
  if (!session || (userRole !== 'admin' && userRole !== 'super_admin')) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  const userIdToFetch = context.params.id;
  if (!userIdToFetch) {
    return NextResponse.json({ message: 'ID de usuario no proporcionado.' }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { data, error } = await supabaseAdmin
      .from('moderation_logs')
      .select(`
        id,
        created_at,
        action,
        reason,
        moderator:profiles!moderator_user_id (
          id,
          first_name,
          last_name
        )
      `)
      .eq('target_user_id', userIdToFetch)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedLogs = await Promise.all(data.map(async (log: any) => {
      const moderator = log.moderator;
      let moderatorName = 'Usuario Desconocido';
      if (moderator) {
        if (moderator.first_name && moderator.last_name) {
          moderatorName = `${moderator.first_name} ${moderator.last_name}`;
        } else {
          const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(moderator.id);
          if (!userError && userData.user) {
            moderatorName = userData.user.email || 'Email no disponible';
          }
        }
      }
      return {
        id: log.id,
        created_at: log.created_at,
        action: log.action,
        reason: log.reason,
        moderator_name: moderatorName,
      };
    }));

    return NextResponse.json(formattedLogs);
  } catch (error: any) {
    console.error(`[API /moderation-history] Error:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: any) {
  const { session, userRole } = await getSessionAndRole();
  if (!session || userRole !== 'super_admin') {
    return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden limpiar el historial de moderación.' }, { status: 403 });
  }

  const userIdToClear = context.params.id;
  if (!userIdToClear) {
    return NextResponse.json({ message: 'ID de usuario no proporcionado.' }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { error } = await supabaseAdmin
      .from('moderation_logs')
      .delete()
      .eq('target_user_id', userIdToClear);

    if (error) {
      console.error(`Error clearing moderation history for user ${userIdToClear}:`, error);
      throw new Error('Error al limpiar el historial de moderación.');
    }

    // Log the action
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      event_type: 'moderation_history_cleared',
      description: `Historial de moderación del usuario ${userIdToClear} limpiado por Super Admin '${session.user.email}'.`,
    });

    return NextResponse.json({ message: 'Historial de moderación limpiado correctamente.' });
  } catch (error: any) {
    console.error(`[API /moderation-history DELETE] Error:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}