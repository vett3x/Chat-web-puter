export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

export async function GET() {
  // Este endpoint simplemente devuelve un 200 OK para indicar que la API está funcionando.
  return NextResponse.json({ status: 'ok' }, { status: 200 });
}