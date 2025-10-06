export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';

const updateTicketSchema = z.object({
  status: z.enum(['new', 'in_progress', 'resolved']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
});

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

export async function GET(req: NextRequest, context: any) { // Usamos 'any' para resolver el error de compilación de TypeScript
  const { session, userRole } = await getSessionAndRole();
  const ticketId = context.params.id;

  if (!session || (userRole !== 'admin' && userRole !== 'super_admin')) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  if (!ticketId) {
    return NextResponse.json({ message: 'ID de ticket no proporcionado.' }, { status: 400 });
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
      .single();

    if (ticketError || !ticketData) {
      console.error('[API /support-tickets/[id] GET] Error fetching ticket or not found:', ticketError);
      return NextResponse.json({ message: 'Ticket no encontrado.' }, { status: 404 });
    }

    // 2. Collect all unique user IDs involved (ticket creator and message senders)
    const involvedUserIds = new Set<string>();
    involvedUserIds.add(ticketData.user_id);
    (ticketData.messages || []).forEach((msg: any) => involvedUserIds.add(msg.sender_id));

    const userIdsArray = Array.from(involvedUserIds);

    // 3. Fetch profiles for all involved users
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', userIdsArray);

    if (profilesError) {
      console.error('[API /support-tickets/[id] GET] Error fetching profiles:', profilesError);
      // Continue, but user names might be missing
    }
    const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // 4. Fetch auth.users data (emails) for all involved users
    const { data: { users: authUsers }, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers();
    if (authUsersError) {
      console.error('[API /support-tickets/[id] GET] Error fetching auth users:', authUsersError);
      // Continue, but emails might be missing
    }
    const authUsersMap = new Map(authUsers?.map(u => [u.id, u]) || []);

    // 5. Format the main ticket creator's user data
    const ticketCreatorProfile = profilesMap.get(ticketData.user_id);
    const ticketCreatorAuthUser = authUsersMap.get(ticketData.user_id);

    const formattedTicketUser = {
      first_name: ticketCreatorProfile?.first_name || null,
      last_name: ticketCreatorProfile?.last_name || null,
      email: ticketCreatorAuthUser?.email || null,
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
          first_name: senderProfile?.first_name || null,
          last_name: senderProfile?.last_name || null,
          email: senderAuthUser?.email || null,
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
    console.error('[API /support-tickets/[id] GET] Unhandled error:', error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: any) { // Usamos 'any' para resolver el error de compilación de TypeScript
  const { session, userRole } = await getSessionAndRole();
  const ticketId = context.params.id;

  if (!session || (userRole !== 'admin' && userRole !== 'super_admin')) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  if (!ticketId) {
    return NextResponse.json({ message: 'ID de ticket no proporcionado.' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const updateData = updateTicketSchema.parse(body);

    const { error } = await supabaseAdmin
      .from('support_tickets')
      .update(updateData)
      .eq('id', ticketId);

    if (error) throw error;
    return NextResponse.json({ message: 'Ticket actualizado.' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error('[API /support-tickets/[id] PUT] Unhandled error:', error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: any) { // Usamos 'any' para resolver el error de compilación de TypeScript
  const { session, userRole } = await getSessionAndRole();
  const ticketId = context.params.id;

  if (!session || (userRole !== 'admin' && userRole !== 'super_admin')) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  if (!ticketId) {
    return NextResponse.json({ message: 'ID de ticket no proporcionado.' }, { status: 400 });
  }

  try {
    // Delete messages first (cascade should handle this, but explicit is safer)
    await supabaseAdmin
      .from('support_ticket_messages')
      .delete()
      .eq('ticket_id', ticketId);

    const { error } = await supabaseAdmin
      .from('support_tickets')
      .delete()
      .eq('id', ticketId);

    if (error) throw error;
    return NextResponse.json({ message: 'Ticket eliminado.' });
  } catch (error: any) {
    console.error('[API /support-tickets/[id] DELETE] Unhandled error:', error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}