export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';

const templateSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1, 'El slug es requerido.').regex(/^[a-z0-9-]+$/, 'Slug inválido (solo minúsculas, números y guiones).'),
  name: z.string().min(1, 'El nombre es requerido.'),
  subject: z.string().min(1, 'El asunto es requerido.'),
  content: z.string().optional(),
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
  if (!isSuperAdmin) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('email_templates')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const templateData = templateSchema.parse(body);
    const { error } = await supabaseAdmin.from('email_templates').insert(templateData);
    if (error) {
      if (error.code === '23505') { // unique constraint violation
        return NextResponse.json({ message: `El slug '${templateData.slug}' ya existe.` }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ message: 'Plantilla creada exitosamente.' }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, ...templateData } = templateSchema.parse(body);
    if (!id) {
      return NextResponse.json({ message: 'Se requiere un ID para actualizar.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('email_templates').update(templateData).eq('id', id);
    if (error) throw error;
    return NextResponse.json({ message: 'Plantilla actualizada exitosamente.' });
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  if (!slug) {
    return NextResponse.json({ message: 'Slug no proporcionado.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('email_templates').delete().eq('slug', slug);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ message: 'Plantilla eliminada exitosamente.' });
}