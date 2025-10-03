export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';

const updatePreferencesSchema = z.object({
  default_ai_model: z.string().optional(),
});

async function getUserId() {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Acceso denegado.');
  return session.user.id;
}

export async function PUT(req: NextRequest, context: any) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const userId = await getUserId();
    const userIdToUpdate = context.params.id;

    if (userId !== userIdToUpdate) {
      return NextResponse.json({ message: 'No puedes modificar las preferencias de otro usuario.' }, { status: 403 });
    }

    const body = await req.json();
    const preferences = updatePreferencesSchema.parse(body);

    const { error } = await supabaseAdmin
      .from('profiles')
      .update(preferences)
      .eq('id', userIdToUpdate);

    if (error) throw error;

    return NextResponse.json({ message: 'Preferencias actualizadas correctamente.' });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error(`[API /users/[id]/preferences] Error:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}