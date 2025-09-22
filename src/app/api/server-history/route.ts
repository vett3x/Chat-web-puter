export const runtime = 'nodejs'; // Force Node.js runtime

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { SUPERUSER_EMAILS } from '@/components/session-context-provider'; // Import SUPERUSER_EMAILS

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

export async function GET(req: NextRequest) {
  const { session, userRole } = await getSessionAndRole();
  if (!session || !userRole) {
    return NextResponse.json({ message: 'Acceso denegado. No autenticado.' }, { status: 401 });
  }
  // Allow Admins and Super Admins to view server history
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

  // Fetch events and join with user_servers to get server names
  const { data: events, error: fetchError } = await supabaseAdmin
    .from('server_events_log')
    .select(`
      id,
      event_type,
      description,
      created_at,
      server_id,
      user_servers (
        name,
        ip_address
      )
    `)
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (fetchError) {
    console.error('Error fetching server events from Supabase (admin):', fetchError);
    return NextResponse.json({ message: 'Error al cargar el historial de eventos.' }, { status: 500 });
  }

  // Format the events to include server name/IP directly
  const formattedEvents = events.map(event => ({
    id: event.id,
    event_type: event.event_type,
    description: event.description,
    created_at: event.created_at,
    server_name: event.user_servers ? (event.user_servers as any).name || (event.user_servers as any).ip_address : 'N/A',
  }));

  return NextResponse.json(formattedEvents, { status: 200 });
}