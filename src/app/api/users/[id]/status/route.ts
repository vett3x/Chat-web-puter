export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { SUPERUSER_EMAILS } from '@/lib/constants';
import { addMinutes } from 'date-fns'; // Import addMinutes

const updateStatusSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('kick'),
    reason: z.string().min(1, { message: 'Se requiere una razón para esta acción.' }),
  }),
  z.object({
    action: z.literal('ban'),
    reason: z.string().min(1, { message: 'Se requiere una razón para esta acción.' }),
  }),
  z.object({
    action: z.literal('unban'),
    reason: z.string().min(1, { message: 'Se requiere una razón para esta acción.' }),
  }),
  z.object({ // NEW: extend_kick action
    action: z.literal('extend_kick'),
    extend_minutes: z.number().int().min(1, { message: 'Los minutos a extender deben ser al menos 1.' }),
    reason: z.string().min(1, { message: 'Se requiere una razón para extender la expulsión.' }),
  }),
]);

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
      .select('role, status, kicked_at') // NEW: Select status and kicked_at
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
    const parsedBody = updateStatusSchema.parse(body);

    let logDescription: string;
    let actionText: string;

    if (parsedBody.action === 'kick') {
      actionText = 'expulsado';
      // Actualizar el estado del perfil a 'kicked' y registrar kicked_at
      await supabaseAdmin.from('profiles').update({ status: 'kicked', kicked_at: new Date().toISOString() }).eq('id', userIdToUpdate);
      // Invalidate user's sessions by updating metadata. This is more reliable than signOut.
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userIdToUpdate, {
        user_metadata: { kicked_at: new Date().toISOString() },
      });
      if (error) throw new Error(`Error al expulsar al usuario: ${error.message}`);
      logDescription = `Usuario ${userIdToUpdate} ${actionText} por ${session.user.email}. Razón: ${parsedBody.reason}`;
    } else if (parsedBody.action === 'ban') {
      actionText = 'baneado';
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userIdToUpdate, { 
        ban_duration: '876000h', // Ban for 100 years
        user_metadata: { banned_at: new Date().toISOString() }, // Also update metadata to invalidate session
      });
      if (banError) throw new Error(`Error al banear al usuario en Auth: ${banError.message}`);
      await supabaseAdmin.from('profiles').update({ status: 'banned', kicked_at: null }).eq('id', userIdToUpdate); // Clear kicked_at on ban
      logDescription = `Usuario ${userIdToUpdate} ${actionText} por ${session.user.email}. Razón: ${parsedBody.reason}`;
    } else if (parsedBody.action === 'unban') {
      actionText = 'desbaneado';
      const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(userIdToUpdate, { ban_duration: 'none' });
      if (unbanError) throw new Error(`Error al desbanear al usuario en Auth: ${unbanError.message}`);
      await supabaseAdmin.from('profiles').update({ status: 'active', kicked_at: null }).eq('id', userIdToUpdate);
      logDescription = `Usuario ${userIdToUpdate} ${actionText} por ${session.user.email}. Razón: ${parsedBody.reason}`;
    } else if (parsedBody.action === 'extend_kick') { // NEW: extend_kick logic
      if (currentUserRole !== 'super_admin') {
        return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden extender expulsiones.' }, { status: 403 });
      }
      if (targetProfile.status !== 'kicked' || !targetProfile.kicked_at) {
        return NextResponse.json({ message: 'El usuario no está actualmente expulsado o no tiene una fecha de expulsión válida para extender.' }, { status: 400 });
      }

      actionText = 'expulsión extendida';
      const currentKickedAt = new Date(targetProfile.kicked_at);
      const newKickedAt = addMinutes(currentKickedAt, parsedBody.extend_minutes);

      await supabaseAdmin.from('profiles').update({ kicked_at: newKickedAt.toISOString() }).eq('id', userIdToUpdate);
      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userIdToUpdate, {
        user_metadata: { kicked_at: newKickedAt.toISOString() },
      });
      if (authUpdateError) throw new Error(`Error al extender la expulsión del usuario: ${authUpdateError.message}`);
      logDescription = `Expulsión del usuario ${userIdToUpdate} extendida por ${parsedBody.extend_minutes} minutos por ${session.user.email}. Nueva fecha de fin: ${newKickedAt.toISOString()}. Razón: ${parsedBody.reason}`;
    } else {
      return NextResponse.json({ message: 'Acción no válida.' }, { status: 400 });
    }

    // Log to both tables
    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      event_type: `user_${parsedBody.action}`,
      description: logDescription,
    });

    await supabaseAdmin.from('moderation_logs').insert({
      target_user_id: userIdToUpdate,
      moderator_user_id: session.user.id,
      action: parsedBody.action,
      reason: parsedBody.reason,
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