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

export async function GET(req: NextRequest, context: any) {
  const { session, userRole } = await getSessionAndRole();
  const userIdToFetch = context.params.id;
  const ticketId = context.params.ticketId;

  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  // A user can only fetch their own ticket details, unless they are an admin/super_admin
  if (session.user.id !== userIdToFetch && userRole !== 'admin' && userRole !== 'super_admin') {
    return NextResponse.json({ message: 'Acceso denegado. No tienes permiso para ver los detalles de este ticket.' }, { status: 403 });
  }

  try {
    // 1. Fetch the main ticket details and its messages
    const { data: ticketData, error: ticketError } = await supabaseAdmin
      .from('support_tickets')
      .select(`
        id,
        created_at,
        subject,
        description,
        status,
        priority,
        user_id,
        messages: support_ticket_messages (
          id,
          created_at,
          content,
          is_internal_note,
          sender_id
        )
      `)
      .eq('id', ticketId)
      .eq('user_id', userIdToFetch) // Ensure the ticket belongs to the user
      .single();

    if (ticketError || !ticketData) {
      console.error('[API /users/[id]/support-tickets/[ticketId] GET] Error fetching ticket or not found:', ticketError);
      return NextResponse.json({ message: 'Ticket no encontrado o no pertenece a este usuario.' }, { status: 404 });
    }

    // 2. Collect all unique user IDs involved (ticket creator and message senders)
    const involvedUserIds = new Set<string>();
    involvedUserIds.add(ticketData.user_id);
    (ticketData.messages || []).forEach((msg: any) => involvedUserIds.add(msg.sender_id));

    const userIdsArray = Array.from(involvedUserIds);

    // 3. Fetch profiles for all involved users
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, avatar_url') // Include avatar_url
      .in('id', userIdsArray);

    if (profilesError) {
      console.error('[API /users/[id]/support-tickets/[ticketId] GET] Error fetching profiles:', profilesError);
      // Continue, but user names might be missing
    }
    const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // 4. Fetch auth.users data (emails) for all involved users
    const { data: { users: authUsers }, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers();
    if (authUsersError) {
      console.error('[API /users/[id]/support-tickets/[ticketId] GET] Error fetching auth users:', authUsersError);
      // Continue, but emails might be missing
    }
    const authUsersMap = new Map(authUsers?.map(u => [u.id, u]) || []);

    // 5. Format the main ticket creator's user data
    const ticketCreatorProfile = profilesMap.get(ticketData.user_id);
    const ticketCreatorAuthUser = authUsersMap.get(ticketData.user_id);

    const formattedTicketUser = {
      id: ticketData.user_id,
      first_name: ticketCreatorProfile?.first_name || null,
      last_name: ticketCreatorProfile?.last_name || null,
      email: ticketCreatorAuthUser?.email || null,
      avatar_url: ticketCreatorProfile?.avatar_url || null,
    };

    // 6. Format messages, including sender details
    const formattedMessages = (ticketData.messages || []).map((msg: any) => {
      const senderProfile = profilesMap.get(msg.sender_id);
      const senderAuthUser = authUsersMap.get(msg.sender_id);

      return {
        id: msg.id,
        created_at: msg.created_at,
        content: msg.content,
        is_internal_note: msg.is_internal_note,
        sender: {
          id: msg.sender_id,
          first_name: senderProfile?.first_name || null,
          last_name: senderProfile?.last_name || null,
          email: senderAuthUser?.email || null,
          avatar_url: senderProfile?.avatar_url || null,
        }
      };
    }).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // 7. Construct the final formatted ticket object
    const formattedTicket = {
      id: ticketData.id,
      created_at: ticketData.created_at,
      subject: ticketData.subject,
      description: ticketData.description,
      status: ticketData.status,
      priority: ticketData.priority,
      user_id: ticketData.user_id,
      user: formattedTicketUser,
      messages: formattedMessages,
    };

    return NextResponse.json(formattedTicket);
  } catch (error: any) {
    console.error('[API /users/[id]/support-tickets/[ticketId] GET] Unhandled error:', error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}