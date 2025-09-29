export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { SUPERUSER_EMAILS } from '@/lib/constants';

const updateQuotasSchema = z.object({
  max_servers: z.number().int().min(0),
  max_containers: z.number().int().min(0),
  max_tunnels: z.number().int().min(0),
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

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest, context: any) {
  const { session, userRole } = await getSessionAndRole();
  if (!session || (userRole !== 'admin' && userRole !== 'super_admin')) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  const userIdToFetch = context.params.id;
  if (!userIdToFetch) {
    return NextResponse.json({ message: 'ID de usuario no proporcionado.' }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('max_servers, max_containers, max_tunnels')
      .eq('id', userIdToFetch)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: any) {
  const { session, userRole } = await getSessionAndRole();
  if (!session || userRole !== 'super_admin') {
    return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden modificar cuotas.' }, { status: 403 });
  }

  const userIdToUpdate = context.params.id;
  if (!userIdToUpdate) {
    return NextResponse.json({ message: 'ID de usuario no proporcionado.' }, { status: 400 });
  }

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
      return NextResponse.json({ message: 'No se pueden modificar las cuotas de un Super Admin.' }, { status: 403 });
    }

    const body = await req.json();
    const quotas = updateQuotasSchema.parse(body);

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(quotas)
      .eq('id', userIdToUpdate);

    if (updateError) throw updateError;

    await supabaseAdmin.from('server_events_log').insert({
      user_id: session.user.id,
      event_type: 'user_quotas_updated',
      description: `Cuotas del usuario ${userIdToUpdate} actualizadas por Super Admin '${session.user.email}'.`,
    });

    return NextResponse.json({ message: 'Cuotas de usuario actualizadas correctamente.' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}