export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { SUPERUSER_EMAILS } from '@/lib/constants';

const aiKeyGroupSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, { message: 'El nombre del grupo es requerido.' }),
  provider: z.string().min(1),
  model_name: z.string().trim().optional().or(z.literal('')),
  is_global: z.boolean().optional(),
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

  if (session.user.email && SUPERUSER_EMAILS.includes(session.user.email)) {
    return { session, userRole: 'super_admin' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  const userRole = profile?.role as 'user' | 'admin' | 'super_admin' | null;
  return { session, userRole };
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { session, userRole } = await getSessionAndRole();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const groupData = aiKeyGroupSchema.parse(body);

    if (groupData.is_global && userRole !== 'super_admin') {
      return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden crear grupos globales.' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('ai_key_groups')
      .insert({
        ...groupData,
        user_id: groupData.is_global ? null : session.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ message: 'Grupo de claves creado correctamente.', group: data }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error("[API /ai-key-groups POST] Unhandled error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { session, userRole } = await getSessionAndRole();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, ...groupData } = aiKeyGroupSchema.parse(body);

    if (!id) {
      return NextResponse.json({ message: 'ID de grupo es requerido para actualizar.' }, { status: 400 });
    }

    const { data: currentGroup, error: fetchError } = await supabaseAdmin
      .from('ai_key_groups')
      .select('user_id, is_global')
      .eq('id', id)
      .single();

    if (fetchError || !currentGroup) {
      throw new Error('Grupo no encontrado o acceso denegado.');
    }

    const isOwner = currentGroup.user_id === session.user.id;
    if (currentGroup.is_global && userRole !== 'super_admin') {
      return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden modificar grupos globales.' }, { status: 403 });
    }
    if (!currentGroup.is_global && !isOwner && userRole !== 'super_admin') {
      return NextResponse.json({ message: 'Acceso denegado. No tienes permiso para modificar este grupo.' }, { status: 403 });
    }
    if (groupData.is_global !== undefined && groupData.is_global !== currentGroup.is_global && userRole !== 'super_admin') {
      return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden cambiar el estado global de un grupo.' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('ai_key_groups')
      .update({
        ...groupData,
        user_id: groupData.is_global ? null : session.user.id,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ message: 'Grupo de claves actualizado correctamente.', group: data });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error("[API /ai-key-groups PUT] Unhandled error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}