export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getPayPalAccessToken } from '@/lib/paypal';

// This helper function should be in a shared lib, but for simplicity, we define it here.
// In a real app, you'd import this from '@/lib/paypal'.
function getPayPalApiUrl(mode: 'sandbox' | 'live'): string {
  return mode === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
}

export async function GET() {
  try {
    const { accessToken, mode } = await getPayPalAccessToken();
    const PAYPAL_API_URL = getPayPalApiUrl(mode);

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