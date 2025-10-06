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
    const { data, error } = await supabaseAdmin
      .from('support_tickets')
      .select(`
        id,
        created_at,
        subject,
        description,
        status,
        priority,
        user:profiles (
          first_name,
          last_name,
          email:auth_users ( email )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
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