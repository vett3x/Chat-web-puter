export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';

const checkSchema = z.object({
  domain: z.string().min(1),
});

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

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

    // 1. Get active domain registrar credentials
    const { data: registrar, error: fetchError } = await supabaseAdmin
      .from('domain_registrars')
      .select('api_username, api_password')
      .eq('is_active', true)
      .eq('status', 'verified')
      .single();

    if (fetchError || !registrar) {
      throw new Error('No se encontró un registrador de dominios activo y verificado. Por favor, configura uno en el Panel de Administración.');
    }

    const { api_username, api_password } = registrar;
    const baseUrl = 'https://dinahosting.com/special/api.php';

    // 2. Check domain availability
    const checkUrl = `${baseUrl}?user=${api_username}&password=${api_password}&command=domain_check&domain_name=${domain}`;
    const checkResponse = await fetch(checkUrl);
    const checkText = await checkResponse.text();
    const checkCode = parseInt(checkText.split(' ')[0], 10);

    if (checkCode === 210) { // Domain is available
      // 3. If available, get the price
      const priceUrl = `${baseUrl}?user=${api_username}&password=${api_password}&command=domain_get_price&domain_name=${domain}&operation=register`;
      const priceResponse = await fetch(priceUrl);
      const priceText = await priceResponse.text();
      const priceCode = parseInt(priceText.split(' ')[0], 10);

      let price = 'Precio no disponible';
      if (priceCode === 200) {
        price = `${priceText.split(' ')[1]} EUR/año`;
      }

      return NextResponse.json({
        domain,
        available: true,
        price,
      });
    } else if (checkCode === 211) { // Domain is not available
      return NextResponse.json({
        domain,
        available: false,
      });
    } else {
      // Handle other Dinahosting API errors
      const errorMessage = checkText.substring(checkText.indexOf(' ') + 1);
      throw new Error(`Error de la API de Dinahosting: ${errorMessage}`);
    }

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error('[API /domains/check] Error:', error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}