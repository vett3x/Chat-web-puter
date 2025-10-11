export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';

const configSchema = z.object({
  provider: z.enum(['google', 'recaptcha']),
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
});

async function getIsSuperAdmin(): Promise<boolean> {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
  return profile?.role === 'super_admin';
}

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });

  try {
    const { data, error } = await supabaseAdmin.from('auth_configs').select('provider, client_id');
    if (error) throw error;

    const configs = data.reduce((acc, { provider, client_id }) => {
      acc[provider] = { client_id: client_id || '' };
      return acc;
    }, {} as Record<string, { client_id: string }>);

    return NextResponse.json(configs);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });

  try {
    const body = await req.json();
    const { provider, client_id, client_secret } = configSchema.parse(body);

    const updateData: { client_id?: string; client_secret?: string; updated_at: string } = { updated_at: new Date().toISOString() };
    if (client_id) updateData.client_id = client_id;
    if (client_secret) updateData.client_secret = client_secret;

    const { error } = await supabaseAdmin
      .from('auth_configs')
      .upsert({ provider, ...updateData }, { onConflict: 'provider' });

    if (error) throw error;
    return NextResponse.json({ message: `Configuración de ${provider} guardada.` });
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}