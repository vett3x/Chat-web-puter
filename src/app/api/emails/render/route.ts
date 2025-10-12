import { NextResponse, type NextRequest } from 'next/server';
import { render } from '@react-email/render';
import * as React from 'react';
import EmailLayout from '@/emails/components/EmailLayout';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('template');

  if (!slug) {
    return NextResponse.json({ message: 'Parámetro "template" (slug) no proporcionado.' }, { status: 400 });
  }

  try {
    const { data: template, error } = await supabaseAdmin
      .from('email_templates')
      .select('name, subject, content')
      .eq('slug', slug)
      .single();

    if (error || !template) {
      return NextResponse.json({ message: `Plantilla con slug "${slug}" no encontrada.` }, { status: 404 });
    }

    const emailComponent = React.createElement(EmailLayout, {
      preview: template.subject,
      title: template.name,
      content: template.content || '',
    });

    const emailHtml = await render(emailComponent);

    return new Response(emailHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });

  } catch (error: any) {
    console.error(`[API /emails/render] Error rendering email template '${slug}':`, error);
    return NextResponse.json({ message: `Error al renderizar la plantilla de correo: ${error.message}` }, { status: 500 });
  }
}