export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

const createTicketSchema = z.object({
  error_message: z.any(),
  conversation_id: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const body = await req.json();
    const { error_message, conversation_id } = createTicketSchema.parse(body);

    const { error } = await supabase.from('error_tickets').insert({
      user_id: userId,
      error_message: error_message,
      conversation_id: conversation_id,
      status: 'new',
    });

    if (error) {
      console.error('Error creating error ticket:', error);
      throw new Error('No se pudo registrar el ticket de error.');
    }

    return NextResponse.json({ message: 'Ticket de error registrado correctamente.' }, { status: 201 });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error('[API /error-tickets] Error:', error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}