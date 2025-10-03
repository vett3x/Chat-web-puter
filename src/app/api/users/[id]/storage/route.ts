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

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const [usageRes, limitRes] = await Promise.all([
      supabaseAdmin.rpc('get_user_storage_usage', { p_user_id: userIdToFetch }),
      supabaseAdmin.from('profiles').select('storage_limit_mb').eq('id', userIdToFetch).maybeSingle() // Use maybeSingle to prevent error if profile not found
    ]);

    if (usageRes.error) throw usageRes.error;
    if (limitRes.error) throw limitRes.error;

    // Handle case where profile might not exist, provide a default limit
    const storageLimitMb = limitRes.data?.storage_limit_mb ?? 100;

    return NextResponse.json({
      usage_bytes: usageRes.data,
      limit_mb: storageLimitMb,
    });
  } catch (error: any) {
    console.error(`[API /storage] Error:`, error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}