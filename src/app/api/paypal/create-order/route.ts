export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { getPayPalAccessToken } from '@/lib/paypal';

export async function POST(req: NextRequest) {
  try {
    const { amount, planName } = await req.json();
    if (!amount || isNaN(parseFloat(amount))) {
      return NextResponse.json({ message: 'El monto es inválido.' }, { status: 400 });
    }
    if (!planName) {
      return NextResponse.json({ message: 'El nombre del plan es requerido.' }, { status: 400 });
    }

    const { accessToken, mode } = await getPayPalAccessToken();
    const PAYPAL_API_URL = mode === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

    const formattedAmount = parseFloat(amount).toFixed(2);

    const response = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'USD',
            value: formattedAmount,
          }
        }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[API PayPal Create Order] PayPal Error Response:', data);
      throw new Error(data.message || 'Error al crear la orden en PayPal.');
    }

    return NextResponse.json({ id: data.id });
  } catch (error: any) {
    console.error('[API PayPal Create Order] Error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}