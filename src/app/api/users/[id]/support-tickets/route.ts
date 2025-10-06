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
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { session: null, userRole: null };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
  const userRole = profile?.role as 'user' | 'admin' | 'super_admin' | null;
  return { session, userRole };
}

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  const { session, userRole } = await getSessionAndRole();
  const userIdToFetch = context.params.id;

  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  // A user can only fetch their own tickets, unless they are an admin/super_admin
  if (session.user.id !== userIdToFetch && userRole !== 'admin' && userRole !== 'super_admin') {
    return NextResponse.json({ message: 'Acceso denegado. No tienes permiso para ver los tickets de este usuario.' }, { status: 403 });
  }

  try {
    const { data: tickets, error: ticketsError } = await supabaseAdmin
      .from('support_tickets')
      .select(`
        id,
        created_at,
        subject,
        description,
        status,
        priority,
        user_id
      `)
      .eq('user_id', userIdToFetch)
      .order('created_at', { ascending: false });

    if (ticketsError) throw ticketsError;

    // For regular users, we don't need to fetch profile/email of other users.
    // For admins, this endpoint is scoped to a specific user, so we just return the tickets.
    const formattedData = tickets.map(ticket => ({
      id: ticket.id,
      created_at: ticket.created_at,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      user_id: ticket.user_id,
    }));

    return NextResponse.json(formattedData);
  } catch (error: any) {
    console.error('[API /users/[id]/support-tickets GET] Error:', error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}