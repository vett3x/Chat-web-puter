export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

async function getSessionAndRole(): Promise<{ session: any; userRole: 'user' | 'admin' | 'super_admin' | null }> {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { session: null, userRole: null };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
  const userRole = profile?.role as 'user' | 'admin' | 'super_admin' | null;
  return { session, userRole };
}

export async function GET(req: NextRequest, context: any) {
  const { session, userRole } = await getSessionAndRole();
  const userIdToFetch = context.params.id;

  if (!session || (session.user.id !== userIdToFetch && userRole !== 'admin' && userRole !== 'super_admin')) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  // NEW: Check for Supabase environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[API /users/[id]/storage] ERROR: Supabase URL or Service Role Key is not set.');
    return NextResponse.json({ message: 'Error de configuración del servidor: Faltan variables de entorno de Supabase.' }, { status: 500 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const [usageRes, limitRes] = await Promise.all([
      supabaseAdmin.rpc('get_user_storage_usage', { p_user_id: userIdToFetch }),
      supabaseAdmin.from('profiles').select('storage_limit_mb').eq('id', userIdToFetch).maybeSingle()
    ]);

    if (usageRes.error) {
      console.error(`[API /users/[id]/storage] Error calling get_user_storage_usage for user ${userIdToFetch}:`, usageRes.error);
      throw new Error(`Error al obtener el uso de almacenamiento: ${usageRes.error.message}`);
    }
    if (limitRes.error) {
      console.error(`[API /users/[id]/storage] Error fetching storage_limit_mb for user ${userIdToFetch}:`, limitRes.error);
      throw new Error(`Error al obtener el límite de almacenamiento: ${limitRes.error.message}`);
    }

    const storageLimitMb = limitRes.data?.storage_limit_mb ?? 100;

    return NextResponse.json({
      usage_bytes: usageRes.data,
      limit_mb: storageLimitMb,
    });
  } catch (error: any) {
    console.error(`[API /users/[id]/storage] Unhandled error for user ${userIdToFetch}:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor al obtener el uso de almacenamiento.' }, { status: 500 });
  }
}