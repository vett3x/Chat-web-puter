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
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('support_tickets')
      .select(`
        id,
        created_at,
        subject,
        description,
        status,
        priority,
        user_id,
        user_data: auth_users!user_id (
          email,
          profile: profiles (
            first_name,
            last_name
          )
        ),
        messages: support_ticket_messages (
          id,
          created_at,
          content,
          is_internal_note,
          sender: auth_users!sender_id (
            email,
            profile: profiles (
              first_name,
              last_name
            )
          )
        )
      `)
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      console.error('[API /support-tickets/[id] GET] Error fetching ticket:', ticketError);
      return NextResponse.json({ message: 'Ticket no encontrado.' }, { status: 404 });
    }

    // Format ticket data
    const userData = Array.isArray(ticket.user_data) ? ticket.user_data[0] : ticket.user_data;
    const userProfileData = userData?.profile;
    const finalUserProfile = Array.isArray(userProfileData) ? userProfileData[0] : userProfileData;

    const formattedMessages = (ticket.messages || []).map((msg: any) => {
      const senderData = Array.isArray(msg.sender) ? msg.sender[0] : msg.sender;
      const senderProfileData = senderData?.profile;
      const finalSenderProfile = Array.isArray(senderProfileData) ? senderProfileData[0] : senderProfileData;

      return {
        id: msg.id,
        created_at: msg.created_at,
        content: msg.content,
        is_internal_note: msg.is_internal_note,
        sender: {
          email: senderData?.email || null,
          first_name: finalSenderProfile?.first_name || null,
          last_name: finalSenderProfile?.last_name || null,
        }
      };
    });

    const formattedTicket = {
      id: ticket.id,
      created_at: ticket.created_at,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      user_id: ticket.user_id,
      user: {
        first_name: finalUserProfile?.first_name || null,
        last_name: finalUserProfile?.last_name || null,
        email: userData?.email || null,
      },
      messages: formattedMessages.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
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