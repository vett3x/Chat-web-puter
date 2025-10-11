export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { getPayPalAccessToken } from '@/lib/paypal';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // In a Route Handler, you would use `cookies().set(...)` on the response
          // but we are not modifying cookies here, so this can be empty.
        },
        remove(name: string, options: CookieOptions) {
          // Same as above.
        },
      },
    }
  );

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ message: 'Usuario no autenticado.' }, { status: 401 });
    }

    const { orderID, planId } = await req.json();
    if (!orderID || !planId) {
      return NextResponse.json({ message: 'Faltan el ID de la orden o el ID del plan.' }, { status: 400 });
    }

    const { accessToken, mode } = await getPayPalAccessToken();
    const PAYPAL_API_URL = mode === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

    const response = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const captureData = await response.json();
    if (!response.ok) {
      console.error('[API PayPal Capture Order] PayPal Error:', captureData);
      throw new Error(captureData.message || 'Error al capturar el pago en PayPal.');
    }

    if (captureData.status === 'COMPLETED') {
      const purchaseUnit = captureData.purchase_units[0];
      const amount = purchaseUnit.payments.captures[0].amount;

      const { error: insertError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: session.user.id,
          plan_id: planId,
          paypal_order_id: orderID,
          status: captureData.status.toLowerCase(),
          amount: amount.value,
          currency: amount.currency_code,
        });

      if (insertError) {
        console.error('[API PayPal Capture Order] Supabase Insert Error:', insertError);
        return NextResponse.json({ message: 'Pago completado, pero hubo un error al registrar tu suscripción. Por favor, contacta a soporte.' }, { status: 500 });
      }

      return NextResponse.json({ message: '¡Pago completado y suscripción registrada exitosamente!', details: captureData });
    } else {
      return NextResponse.json({ message: `El estado del pago es '${captureData.status}'.`, details: captureData }, { status: 400 });
    }

  } catch (error: any) {
    console.error('[API PayPal Capture Order] Error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}