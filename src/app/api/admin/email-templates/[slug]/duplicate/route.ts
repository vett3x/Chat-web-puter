export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

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

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  const originalSlug = params.slug;
  if (!originalSlug) {
    return NextResponse.json({ message: 'Slug de la plantilla original no proporcionado.' }, { status: 400 });
  }

  try {
    // 1. Fetch the original template
    const { data: originalTemplate, error: fetchError } = await supabaseAdmin
      .from('email_templates')
      .select('*')
      .eq('slug', originalSlug)
      .single();

    if (fetchError || !originalTemplate) {
      return NextResponse.json({ message: 'Plantilla original no encontrada.' }, { status: 404 });
    }

    // 2. Generate a new unique slug and name
    let newSlug = `${originalTemplate.slug}-copia`;
    let newName = `Copia de ${originalTemplate.name}`;
    let counter = 2;
    let isUnique = false;

    while (!isUnique) {
      const { data: existing, error } = await supabaseAdmin
        .from('email_templates')
        .select('slug')
        .eq('slug', newSlug)
        .maybeSingle();

      if (error) throw error;

      if (!existing) {
        isUnique = true;
      } else {
        newSlug = `${originalTemplate.slug}-copia-${counter}`;
        newName = `Copia de ${originalTemplate.name} (${counter})`;
        counter++;
      }
    }

    // 3. Create the new template
    const { data: newTemplate, error: insertError } = await supabaseAdmin
      .from('email_templates')
      .insert({
        slug: newSlug,
        name: newName,
        subject: originalTemplate.subject,
        content: originalTemplate.content,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ message: 'Plantilla duplicada exitosamente.', newTemplate }, { status: 201 });

  } catch (error: any) {
    console.error('[API /email-templates/duplicate] Error:', error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}