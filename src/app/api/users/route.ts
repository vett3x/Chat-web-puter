export const runtime = 'nodejs'; // Force Node.js runtime

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const SUPERUSER_EMAILS = ['martinpensa1@gmail.com']; // Define SuperUser emails

async function getSession() {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) {},
        remove(name: string, options: CookieOptions) {},
      },
    }
  );
  return supabase.auth.getSession();
}

// Define una interfaz para el resultado de la consulta de Supabase
interface SupabaseUserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  auth_users: { email: string | null } | null;
}

export async function GET(req: NextRequest) {
  const { data: { session } } = await getSession();
  if (!session || !session.user?.email || !SUPERUSER_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
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
    // Fetch users from auth.users and join with public.profiles
    const { data: users, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        first_name,
        last_name,
        avatar_url,
        auth_users:auth.users(email)
      `) as { data: SupabaseUserProfile[] | null, error: any }; // Castear el resultado

    if (error) {
      console.error('Error fetching users from Supabase (admin):', error);
      throw new Error('Error al cargar los usuarios.');
    }

    // Flatten the data to include email directly
    const formattedUsers = (users || []).map(profile => ({
      id: profile.id,
      first_name: profile.first_name,
      last_name: profile.last_name,
      avatar_url: profile.avatar_url,
      email: profile.auth_users?.email || 'N/A',
    }));

    return NextResponse.json(formattedUsers, { status: 200 });

  } catch (error: any) {
    console.error('Error in GET /api/users:', error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}