export const runtime = 'nodejs'; // Force Node.js runtime

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { SUPERUSER_EMAILS } from '@/components/session-context-provider'; // Import SUPERUSER_EMAILS

const updateRoleSchema = z.object({
  role: z.enum(['user', 'admin', 'super_admin'], { message: 'Rol inválido.' }),
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

export async function PUT(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const userIdToUpdate = context.params.id;

  if (!userIdToUpdate) {
    return NextResponse.json({ message: 'ID de usuario no proporcionado.' }, { status: 400 });
  }

  const { data: { session } } = await getSession();
  // Only Super Admins can update roles
  if (!session || !session.user?.email || !SUPERUSER_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden cambiar roles.' }, { status: 403 });
  }

  // Prevent Super Admin from changing their own role via this UI
  if (session.user.id === userIdToUpdate) {
    return NextResponse.json({ message: 'No puedes cambiar tu propio rol de Super Admin a través de esta interfaz.' }, { status: 403 });
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
    const { role: newRole } = updateRoleSchema.parse(body);

    // Prevent changing a Super Admin's role to anything else via this UI
    const { data: targetProfile, error: fetchProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userIdToUpdate)
      .single();

    if (fetchProfileError || !targetProfile) {
      console.error(`Error fetching target user profile ${userIdToUpdate}:`, fetchProfileError);
      return NextResponse.json({ message: 'Usuario objetivo no encontrado.' }, { status: 404 });
    }

    if (targetProfile.role === 'super_admin' && newRole !== 'super_admin') {
      return NextResponse.json({ message: 'No puedes cambiar el rol de un Super Admin a través de esta interfaz.' }, { status: 403 });
    }
    
    // Super Admin role can only be assigned via initial setup (email check in trigger)
    // or directly in the database. Prevent assigning 'super_admin' via this API.
    if (newRole === 'super_admin') {
        return NextResponse.json({ message: 'El rol de Super Admin no puede ser asignado a través de esta interfaz.' }, { status: 403 });
    }


    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userIdToUpdate)
      .select('id, role')
      .single();

    if (error) {
      console.error(`Error updating role for user ${userIdToUpdate}:`, error);
      await supabaseAdmin.from('server_events_log').insert({
        user_id: session.user.id,
        event_type: 'user_role_update_failed',
        description: `Fallo al actualizar el rol del usuario ${userIdToUpdate} a '${newRole}'. Error: ${error.message}`,
      });
      throw new Error(`Error al actualizar el rol del usuario: ${error.message}`);
    }

    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      event_type: 'user_role_updated',
      description: `Rol del usuario ${userIdToUpdate} actualizado a '${newRole}' por Super Admin '${session.user.email}'.`,
    });

    return NextResponse.json({ message: 'Rol de usuario actualizado correctamente.', user: data }, { status: 200 });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error('Unhandled error in PUT /api/users/[id]/role:', error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}