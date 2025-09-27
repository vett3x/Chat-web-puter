export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { SUPERUSER_EMAILS } from '@/lib/constants';

const updateStatusSchema = z.object({
  action: z.enum(['kick', 'ban', 'unban']),
});

async function getIsSuperAdmin(): Promise<string | null> {
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
  if (!session) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  return profile?.role === 'super_admin' ? session.user.id : null;
}

export async function PUT(req: NextRequest, context: any) {
  const currentUserId = await getIsSuperAdmin();
  if (!currentUserId) {
    return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden realizar esta acción.' }, { status: 403 });
  }

  const userIdToUpdate = context.params.id;
  if (!userIdToUpdate) {
    return NextResponse.json({ message: 'ID de usuario no proporcionado.' }, { status: 400 });
  }

  if (userIdToUpdate === currentUserId) {
    return NextResponse.json({ message: 'No puedes modificar tu propio estado.' }, { status: 403 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { data: targetProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userIdToUpdate)
      .single();

    if (profileError || !targetProfile) {
      return NextResponse.json({ message: 'Usuario objetivo no encontrado.' }, { status: 404 });
    }
    if (targetProfile.role === 'super_admin') {
      return NextResponse.json({ message: 'No se puede modificar el estado de un Super Admin.' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = updateStatusSchema.parse(body);

    let logDescription = '';
    let successMessage = '';

    if (action === 'kick') {
      const { error } = await supabaseAdmin.auth.admin.signOut(userIdToUpdate);
      if (error) throw new Error(`Error al expulsar al usuario: ${error.message}`);
      logDescription = `Usuario ${userIdToUpdate} expulsado.`;
      successMessage = 'Usuario expulsado correctamente. Su sesión ha sido terminada.';
    } else if (action === 'ban') {
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userIdToUpdate, {
        ban_duration: '876000h', // 100 years
      });
      if (banError) throw new Error(`Error al banear al usuario en Auth: ${banError.message}`);
      
      await supabaseAdmin.from('profiles').update({ status: 'banned' }).eq('id', userIdToUpdate);
      await supabaseAdmin.auth.admin.signOut(userIdToUpdate);
      
      logDescription = `Usuario ${userIdToUpdate} baneado.`;
      successMessage = 'Usuario baneado y expulsado correctamente.';
    } else if (action === 'unban') {
      const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(userIdToUpdate, {
        ban_duration: 'none',
      });
      if (unbanError) throw new Error(`Error al desbanear al usuario en Auth: ${unbanError.message}`);
      
      await supabaseAdmin.from('profiles').update({ status: 'active' }).eq('id', userIdToUpdate);
      
      logDescription = `Usuario ${userIdToUpdate} desbaneado.`;
      successMessage = 'Usuario desbaneado correctamente.';
    }

    await supabaseAdmin.from('server_events_log').insert({
      user_id: currentUserId,
      event_type: `user_${action}`,
      description: logDescription,
    });

    return NextResponse.json({ message: successMessage });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error(`[API /users/${userIdToUpdate}/status] Error:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}