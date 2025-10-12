import { NextResponse, type NextRequest } from 'next/server';
import { render } from '@react-email/render';
import * as React from 'react';
import WelcomeEmail from '@/emails/WelcomeEmail';
import ResetPasswordEmail from '@/emails/ResetPasswordEmail';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const template = searchParams.get('template');

  try {
    let emailHtml: string;
    let emailComponent: React.ReactElement;

    switch (template) {
      case 'welcome':
        emailComponent = React.createElement(WelcomeEmail);
        break;
      case 'reset-password':
        emailComponent = React.createElement(ResetPasswordEmail);
        break;
      default:
        return NextResponse.json({ message: 'Plantilla de correo no válida. Usa ?template=welcome o ?template=reset-password' }, { status: 400 });
    }

    emailHtml = await render(emailComponent);

    return new Response(emailHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });

  } catch (error: any) {
    console.error(`[API /emails/render] Error rendering email template '${template}':`, error);
    return NextResponse.json({ message: `Error al renderizar la plantilla de correo: ${error.message}` }, { status: 500 });
  }
}