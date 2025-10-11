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
          // Provide a detailed breakdown of the items being purchased.
          // This is crucial for PayPal's validation during the capture step.
          items: [
            {
              name: planName, // The name of the subscription plan
              quantity: '1',
              unit_amount: {
                currency_code: 'USD',
                value: formattedAmount, // The price of this single item
              },
            },
          ],
          // The total amount object, which must match the sum of the items.
          amount: {
            currency_code: 'USD',
            value: formattedAmount, // The final total
            // The breakdown explicitly states how the total is calculated.
            breakdown: {
              item_total: {
                currency_code: 'USD',
                value: formattedAmount, // Sum of all items (in our case, just one)
              },
            },
          },
        }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[API PayPal Create Order] PayPal Error Response:', data);
      // Provide more detailed error from PayPal if available
      const errorMessage = data.details?.[0]?.description || data.message || 'Error al crear la orden en PayPal.';
      throw new Error(errorMessage);
    }

    return NextResponse.json({ id: data.id });
  } catch (error: any) {
    console.error('[API PayPal Create Order] Error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}