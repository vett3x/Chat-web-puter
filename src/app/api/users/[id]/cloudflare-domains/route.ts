export const runtime = 'nodejs'; // Force Node.js runtime

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { SUPERUSER_EMAILS } from '@/lib/constants'; // Importación actualizada

// Helper function to get the session and user role
async function getSessionAndRole() {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {},
        remove(name: string, options: CookieOptions) {},
      },
    }
  );
  const { data: { session } } = await supabase.auth.getSession();

  let userRole: 'user' | 'admin' | 'super_admin' | null = null;
  if (session?.user?.id) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();
    if (profile) {
      userRole = profile.role as 'user' | 'admin' | 'super_admin';
    } else if (session.user.email && SUPERUSER_EMAILS.includes(session.user.email)) {
      userRole = 'super_admin'; // Fallback for initial Super Admin
    }
  }
  return { session, userRole };
}

export async function GET(
  req: NextRequest,
  context: any // Usamos 'any' para resolver el error de compilación de TypeScript
) {
  const userIdToFetch = context.params.id;

  if (!userIdToFetch) {
    return NextResponse.json({ message: 'ID de usuario no proporcionado.' }, { status: 400 });
  }

  const { session, userRole } = await getSessionAndRole();
  if (!session || !userRole) {
    return NextResponse.json({ message: 'Acceso denegado. No autenticado.' }, { status: 401 });
  }
  // Allow Admins and Super Admins to view other users' Cloudflare domains
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return NextResponse.json({ message: 'Acceso denegado. Se requiere rol de Admin o Super Admin.' }, { status: 403 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables.');
    return NextResponse.json({ message: 'Error de configuración del servidor.' }, { status: 500 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { data: domains, error } = await supabaseAdmin
      .from('cloudflare_domains')
      .select('id, domain_name, zone_id, account_id, created_at')
      .eq('user_id', userIdToFetch)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Error fetching Cloudflare domains for user ${userIdToFetch}:`, error);
      throw new Error('Error al cargar los dominios de Cloudflare del usuario.');
    }

    return NextResponse.json(domains, { status: 200 });

  } catch (error: any) {
    console.error(`Unhandled error in GET /api/users/${userIdToFetch}/cloudflare-domains:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}