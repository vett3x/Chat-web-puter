export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { SUPERUSER_EMAILS } from '@/lib/constants';

const updateAccountSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('email'),
    email: z.string().email({ message: 'Correo electrónico inválido.' }),
  }),
  z.object({
    type: z.literal('password'),
    password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres.' }),
  }),
]);

async function getIsSuperAdmin(): Promise<boolean> {
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
  if (!session) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  return profile?.role === 'super_admin';
}

export async function PUT(req: NextRequest, context: any) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) {
    return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden realizar esta acción.' }, { status: 403 });
  }

  const userIdToUpdate = context.params.id;
  if (!userIdToUpdate) {
    return NextResponse.json({ message: 'ID de usuario no proporcionado.' }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const body = await req.json();
    const parsedBody = updateAccountSchema.parse(body);

    // Check if the target user is a Super Admin
    const { data: targetProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userIdToUpdate)
      .single();

    if (profileError || !targetProfile) {
      return NextResponse.json({ message: 'Usuario objetivo no encontrado.' }, { status: 404 });
    }
    if (targetProfile.role === 'super_admin') {
      return NextResponse.json({ message: 'No se pueden modificar los datos de la cuenta de un Super Admin.' }, { status: 403 });
    }

    let updateResult;
    if (parsedBody.type === 'email') {
      updateResult = await supabaseAdmin.auth.admin.updateUserById(userIdToUpdate, {
        email: parsedBody.email,
      });
    } else { // password
      updateResult = await supabaseAdmin.auth.admin.updateUserById(userIdToUpdate, {
        password: parsedBody.password,
      });
    }

    const { error: updateError } = updateResult;
    if (updateError) {
      console.error(`Error updating user ${userIdToUpdate}:`, updateError);
      throw new Error(updateError.message);
    }

    return NextResponse.json({ message: `El ${parsedBody.type === 'email' ? 'correo electrónico' : 'contraseña'} del usuario ha sido actualizado.` });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error(`[API /users/${userIdToUpdate}/account] Error:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}