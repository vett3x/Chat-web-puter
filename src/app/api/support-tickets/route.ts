export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';

const ticketSchema = z.object({
  subject: z.string().min(5, 'El asunto debe tener al menos 5 caracteres.').max(100),
  description: z.string().min(20, 'La descripción debe tener al menos 20 caracteres.').max(2000),
  priority: z.enum(['low', 'medium', 'high']),
});

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

export async function GET(req: NextRequest) {
  const { session, userRole } = await getSessionAndRole();
  if (!session || (userRole !== 'admin' && userRole !== 'super_admin')) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  try {
    // 1. Fetch all support tickets with just the user_id
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
      .order('created_at', { ascending: false });

    if (ticketsError) throw ticketsError;

    // 2. Collect all unique user IDs from the tickets
    const uniqueUserIds = [...new Set(tickets.map(ticket => ticket.user_id))];

    // 3. Fetch all profiles for these unique user IDs
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', uniqueUserIds);

    if (profilesError) {
      console.error('[API /support-tickets GET] Error fetching profiles:', profilesError);
      // Continue even if profiles fail, just user names might be missing
    }
    const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // 4. Fetch user emails from auth.users for these unique user IDs
    // Note: supabase.auth.admin.listUsers() is more efficient than getUserById in a loop
    const { data: { users: authUsers }, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers();
    if (authUsersError) {
      console.error('[API /support-tickets GET] Error fetching auth users:', authUsersError);
      // Continue even if auth users fail
    }
    const authUsersMap = new Map(authUsers?.map(u => [u.id, u]) || []);


    // 5. Format the data, combining ticket, profile, and email information
    const formattedData = tickets.map(ticket => {
      const profile = profilesMap.get(ticket.user_id);
      const authUser = authUsersMap.get(ticket.user_id);

      return {
        id: ticket.id,
        created_at: ticket.created_at,
        subject: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        user: {
          first_name: profile?.first_name || null,
          last_name: profile?.last_name || null,
          email: { email: authUser?.email || null }
        }
      };
    });

    return NextResponse.json(formattedData);
  } catch (error: any) {
    console.error('[API /support-tickets GET] Error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { session } = await getSessionAndRole();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const ticketData = ticketSchema.parse(body);

    const { error } = await supabaseAdmin
      .from('support_tickets')
      .insert({ ...ticketData, user_id: session.user.id });

    if (error) throw error;
    return NextResponse.json({ message: 'Ticket de soporte enviado.' }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
    const { session, userRole } = await getSessionAndRole();
    if (!session || (userRole !== 'admin' && userRole !== 'super_admin')) {
        return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ message: 'ID de ticket no proporcionado.' }, { status: 400 });

    try {
        const body = await req.json();
        const updateData = updateTicketSchema.parse(body);

        const { error } = await supabaseAdmin
            .from('support_tickets')
            .update(updateData)
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ message: 'Ticket actualizado.' });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
        }
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const { session, userRole } = await getSessionAndRole();
    if (!session || (userRole !== 'admin' && userRole !== 'super_admin')) {
        return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ message: 'ID de ticket no proporcionado.' }, { status: 400 });

    const { error } = await supabaseAdmin
        .from('support_tickets')
        .delete()
        .eq('id', id);

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    return NextResponse.json({ message: 'Ticket eliminado.' });
}