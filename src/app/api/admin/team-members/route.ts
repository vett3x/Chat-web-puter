export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';

const memberSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'El nombre es requerido.'),
  title: z.string().optional().nullable(),
  handle: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  contact_text: z.string().optional().nullable(),
  avatar_url: z.string().url('Debe ser una URL válida.').optional().nullable(),
  order_index: z.coerce.number().int().optional(),
});

async function getIsSuperAdmin(): Promise<boolean> {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
  return profile?.role === 'super_admin';
}

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });

  try {
    const { data, error } = await supabaseAdmin
      .from('team_members')
      .select('*')
      .order('order_index', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });

  try {
    const body = await req.json();
    const memberData = memberSchema.parse(body);
    const { error } = await supabaseAdmin.from('team_members').insert(memberData);
    if (error) throw error;
    return NextResponse.json({ message: 'Miembro del equipo creado.' }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });

  try {
    const body = await req.json();
    const { id, ...memberData } = memberSchema.parse(body);
    if (!id) return NextResponse.json({ message: 'Se requiere un ID para actualizar.' }, { status: 400 });

    const { error } = await supabaseAdmin.from('team_members').update(memberData).eq('id', id);
    if (error) throw error;
    return NextResponse.json({ message: 'Miembro del equipo actualizado.' });
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ message: 'ID no proporcionado.' }, { status: 400 });

  const { error } = await supabaseAdmin.from('team_members').delete().eq('id', id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ message: 'Miembro del equipo eliminado.' });
}