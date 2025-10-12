export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

const checkSchema = z.object({
  domain: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => req.cookies.get(name)?.value } }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { domain } = checkSchema.parse(body);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock logic: any domain containing 'test' or 'example' is taken.
    const isTaken = domain.toLowerCase().includes('test') || domain.toLowerCase().includes('example');

    if (isTaken) {
      return NextResponse.json({
        domain,
        available: false,
      });
    }

    // Simulate a price for available domains
    const price = (Math.random() * 10 + 5).toFixed(2);

    return NextResponse.json({
      domain,
      available: true,
      price: `$${price}/año`,
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error('[API /domains/check] Error:', error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}