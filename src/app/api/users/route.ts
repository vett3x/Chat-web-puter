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
interface SupabaseProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin' | 'super_admin'; // Added role
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
    // 1. Fetch all profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select(`id, first_name, last_name, avatar_url, role`); // Select role

    if (profilesError) {
      console.error('Supabase query error fetching profiles in GET /api/users:', profilesError);
      throw new Error('Error al cargar los perfiles de usuario desde la base de datos.');
    }

    // 2. For each profile, fetch the corresponding user email from auth.users
    const formattedUsers = await Promise.all((profiles || []).map(async (profile: SupabaseProfile) => {
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id);
      
      if (userError) {
        console.warn(`Error fetching email for user ID ${profile.id}:`, userError);
        return {
          id: profile.id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          avatar_url: profile.avatar_url,
          email: 'N/A (Error al obtener email)',
          role: profile.role, // Include role even if email fails
        };
      }

      return {
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        avatar_url: profile.avatar_url,
        email: userData.user?.email || 'N/A',
        role: profile.role, // Include role
      };
    }));

    return NextResponse.json(formattedUsers, { status: 200 });

  } catch (error: any) {
    console.error('Unhandled error in GET /api/users:', error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}