export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';

const messageSchema = z.object({
  content: z.string().min(1, 'El contenido del mensaje no puede estar vacío.'),
  is_internal_note: z.boolean().default(false), // Eliminado .optional()
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

export async function POST(req: NextRequest, context: any) {
  const { session, userRole } = await getSessionAndRole();
  const ticketId = context.params.id;

  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  if (!ticketId) {
    return NextResponse.json({ message: 'ID de ticket no proporcionado.' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { content, is_internal_note } = messageSchema.parse(body);

    // Check if the user is an admin or the owner of the ticket
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('support_tickets')
      .select('user_id')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ message: 'Ticket no encontrado o acceso denegado.' }, { status: 404 });
    }

    const isTicketOwner = ticket.user_id === session.user.id;
    const isAdminOrSuperAdmin = userRole === 'admin' || userRole === 'super_admin';

    if (!isAdminOrSuperAdmin && !isTicketOwner) {
      return NextResponse.json({ message: 'Acceso denegado. No eres el propietario del ticket ni un administrador.' }, { status: 403 });
    }

    // Only admins can send internal notes
    if (is_internal_note && !isAdminOrSuperAdmin) {
      return NextResponse.json({ message: 'Acceso denegado. Solo los administradores pueden enviar notas internas.' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('support_ticket_messages')
      .insert({
        ticket_id: ticketId,
        sender_id: session.user.id,
        content,
        is_internal_note,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ message: 'Mensaje añadido al ticket.', newMessage: data }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error('[API /support-tickets/[id]/messages POST] Unhandled error:', error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}