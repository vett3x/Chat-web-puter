export const runtime = 'nodejs'; // Force Node.js runtime

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { SUPERUSER_EMAILS } from '@/components/session-context-provider'; // Import SUPERUSER_EMAILS

// Esquema de validación para añadir un nuevo usuario
const addUserSchema = z.object({
  email: z.string().email({ message: 'Correo electrónico inválido.' }),
  password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres.' }),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  role: z.enum(['user', 'admin']).default('user'), // Allow Super Admin to set 'user' or 'admin' role
});

async function getSession() {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) {},
        remove(name: string, options: CookieOptions) {},
      },
    }
  );
  return supabase.auth.getSession();
}

export async function POST(req: NextRequest) {
  const { data: { session } } = await getSession();
  // Only Super Admins can create users
  if (!session || !session.user?.email || !SUPERUSER_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden crear usuarios.' }, { status: 403 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables.');
    return NextResponse.json({ message: 'Error de configuración del servidor.' }, { status: 500 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const body = await req.json();
    const newUserData = addUserSchema.parse(body);

    // Create user in Supabase Auth
    const { data: user, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: newUserData.email,
      password: newUserData.password,
      email_confirm: true, // Automatically confirm email for admin-created users
      user_metadata: {
        first_name: newUserData.first_name,
        last_name: newUserData.last_name,
        role: newUserData.role, // Pass role to user_metadata for trigger
      },
    });

    if (authError) {
      console.error('Error creating user in Supabase Auth:', authError);
      // Log event for failed user creation
      await supabaseAdmin.from('server_events_log').insert({
        user_id: session.user.id,
        event_type: 'user_create_failed',
        description: `Fallo al crear usuario '${newUserData.email}'. Error: ${authError.message}`,
      });
      return NextResponse.json({ message: authError.message || 'Error al crear el usuario.' }, { status: 500 });
    }

    // The public.profiles table should be automatically populated by the handle_new_user trigger.
    // The trigger now reads 'role' from raw_user_meta_data.
    // If the trigger doesn't set the role correctly, we can explicitly update it here.
    if (user.user?.id) {
      const { error: updateProfileError } = await supabaseAdmin
        .from('profiles')
        .update({ role: newUserData.role })
        .eq('id', user.user.id);

      if (updateProfileError) {
        console.error(`Error updating profile role for new user ${user.user.id}:`, updateProfileError);
        // Log this as a warning, but don't fail the user creation entirely
        await supabaseAdmin.from('server_events_log').insert({
          user_id: session.user.id,
          event_type: 'user_create_warning',
          description: `Advertencia: Rol no establecido correctamente para el nuevo usuario '${newUserData.email}'. Error: ${updateProfileError.message}`,
        });
      }
    }

    // Log event for successful user creation
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      event_type: 'user_created',
      description: `Usuario '${newUserData.email}' (ID: ${user.user?.id}) con rol '${newUserData.role}' creado por Super Admin '${session.user.email}'.`,
    });

    return NextResponse.json(
      { message: `Usuario '${newUserData.email}' creado correctamente.`, userId: user.user?.id },
      { status: 201 }
    );

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error('Unhandled error in POST /api/users/create:', error);
    // Log event for general error during user creation
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      event_type: 'user_create_failed',
      description: `Error inesperado al crear usuario. Error: ${error.message}`,
    });
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}