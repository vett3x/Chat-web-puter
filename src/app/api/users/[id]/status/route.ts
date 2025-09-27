export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { SUPERUSER_EMAILS } from '@/lib/constants';

const updateStatusSchema = z.object({
  action: z.enum(['kick', 'ban', 'unban']),
  reason: z.string().min(1, { message: 'Se requiere una razón para esta acción.' }),
});

async function getSessionAndRole(): Promise<{ session: any; userRole: 'user' | 'admin' | 'super_admin' | null }> {
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
  if (!session) return { session: null, userRole: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  const userRole = profile?.role as 'user' | 'admin' | 'super_admin' | null;
  return { session, userRole };
}

export async function PUT(req: NextRequest, context: any) {
  const { session, userRole: currentUserRole } = await getSessionAndRole();
  if (!session || (currentUserRole !== 'admin' && currentUserRole !== 'super_admin')) {
    return NextResponse.json({ message: 'Acceso denegado. Se requiere rol de Admin o superior.' }, { status: 403 });
  }

  const userIdToUpdate = context.params.id;
  if (!userIdToUpdate) {
    return NextResponse.json({ message: 'ID de usuario no proporcionado.' }, { status: 400 });
  }

  if (userIdToUpdate === session.user.id) {
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
    if (currentUserRole === 'admin' && targetProfile.role === 'admin') {
      return NextResponse.json({ message: 'Un Admin no puede modificar el estado de otro Admin.' }, { status: 403 });
    }

    const body = await req.json();
    const { action, reason } = updateStatusSchema.parse(body);

    const actionText = { kick: 'expulsado', ban: 'baneado', unban: 'desbaneado' }[action];

    if (action === 'kick') {
      // Actualizar el estado del perfil a 'kicked' y registrar kicked_at
      await supabaseAdmin.from('profiles').update({ status: 'kicked', kicked_at: new Date().toISOString() }).eq('id', userIdToUpdate);
      // Invalidate user's sessions by updating metadata. This is more reliable than signOut.
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userIdToUpdate, {
        user_metadata: { kicked_at: new Date().toISOString() },
      });
      if (error) throw new Error(`Error al expulsar al usuario: ${error.message}`);
    } else if (action === 'ban') {
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userIdToUpdate, { 
        ban_duration: '876000h', // Ban for 100 years
        user_metadata: { banned_at: new Date().toISOString() }, // Also update metadata to invalidate session
      });
      if (banError) throw new Error(`Error al banear al usuario en Auth: ${banError.message}`);
      await supabaseAdmin.from('profiles').update({ status: 'banned', kicked_at: null }).eq('id', userIdToUpdate); // Clear kicked_at on ban
    } else if (action === 'unban') {
      const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(userIdToUpdate, { ban_duration: 'none' });
      if (unbanError) throw new Error(`Error al desbanear al usuario en Auth: ${unbanError.message}`);
      await supabaseAdmin.from('profiles').update({ status: 'active', kicked_at: null }).eq('id', userIdToUpdate);
    }

    // Log to both tables
    const logDescription = `Usuario ${userIdToUpdate} ${actionText} por ${session.user.email}. Razón: ${reason}`;
    
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      event_type: `user_${action}`,
      description: logDescription,
    });

    await supabaseAdmin.from('moderation_logs').insert({
      target_user_id: userIdToUpdate,
      moderator_user_id: session.user.id,
      action: action,
      reason: reason,
    });

    return NextResponse.json({ message: `Usuario ${actionText} correctamente.` });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error(`[API /users/${userIdToUpdate}/status] Error:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}