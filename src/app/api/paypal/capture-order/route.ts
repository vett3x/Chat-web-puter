export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { getPayPalAccessToken } from '@/lib/paypal';

const PAYPAL_API_URL = 'https://api-m.sandbox.paypal.com';

export async function POST(req: NextRequest) {
  try {
    const { orderID } = await req.json();
    if (!orderID) {
      return NextResponse.json({ message: 'El ID de la orden es requerido.' }, { status: 400 });
    }

    const accessToken = await getPayPalAccessToken();

    const response = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Error al capturar el pago en PayPal.');
    }

    // Aquí podrías guardar la transacción en tu base de datos
    // y actualizar el plan del usuario.

    return NextResponse.json({ message: 'Pago completado exitosamente.', details: data });
  } catch (error: any) {
    console.error('[API PayPal Capture Order] Error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}