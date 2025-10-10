export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getPayPalAccessToken } from '@/lib/paypal';

const PAYPAL_API_URL = 'https://api-m.sandbox.paypal.com'; // O la URL de producción

export async function GET() {
  try {
    const accessToken = await getPayPalAccessToken();

    const response = await fetch(`${PAYPAL_API_URL}/v1/identity/generate-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Error al generar el client token de PayPal.');
    }

    return NextResponse.json({ clientToken: data.client_token });
  } catch (error: any) {
    console.error('[API PayPal Client Token] Error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}