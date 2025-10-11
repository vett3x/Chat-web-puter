export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido.'),
  email: z.string().email('El email es inválido.'),
  message: z.string().min(10, 'El mensaje debe tener al menos 10 caracteres.'),
  recaptchaToken: z.string().min(1, 'El token de reCAPTCHA es requerido.'),
});

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function verifyRecaptcha(token: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('auth_configs')
    .select('client_secret')
    .eq('provider', 'recaptcha')
    .single();

  if (error || !data?.client_secret) {
    console.error('reCAPTCHA secret key not configured.');
    return false;
  }

  const secretKey = data.client_secret;
  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${secretKey}&response=${token}`,
  });

  const result = await response.json();
  return result.success;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, message, recaptchaToken } = contactSchema.parse(body);

    const isHuman = await verifyRecaptcha(recaptchaToken);
    if (!isHuman) {
      return NextResponse.json({ message: 'Verificación de reCAPTCHA fallida.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('contact_messages')
      .insert({ name, email, message });

    if (error) throw error;

    return NextResponse.json({ message: '¡Gracias por tu mensaje! Nos pondremos en contacto contigo pronto.' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error('[API Contact] Error:', error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}