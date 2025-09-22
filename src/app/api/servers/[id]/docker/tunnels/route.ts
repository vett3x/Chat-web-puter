export const runtime = 'nodejs'; // Force Node.js runtime

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const SUPERUSER_EMAILS = ['martinpensa1@gmail.com'];

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

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const serverId = context.params.id;

  if (!serverId) {
    return NextResponse.json({ message: 'ID de servidor no proporcionado.' }, { status: 400 });
  }

  const { data: { session } } = await getSession();
  if (!session || !session.user?.email || !SUPERUSER_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set.');
    return NextResponse.json({ message: 'Error de configuración del servidor.' }, { status: 500 });
  }

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const { data: tunnels, error } = await supabaseAdmin
      .from('docker_tunnels')
      .select(`
        id,
        container_id,
        full_domain,
        container_port,
        status,
        cloudflare_domains (
          domain_name
        )
      `)
      .eq('server_id', serverId)
      .eq('user_id', session.user.id);

    if (error) {
      console.error('Error fetching Docker tunnels for server:', error);
      throw new Error('Error al cargar los túneles Docker.');
    }

    // Flatten the data to include domain_name directly
    const formattedTunnels = tunnels.map(tunnel => ({
      id: tunnel.id,
      container_id: tunnel.container_id,
      full_domain: tunnel.full_domain,
      container_port: tunnel.container_port,
      status: tunnel.status,
      domain_name: (tunnel.cloudflare_domains as any)?.domain_name || 'N/A',
    }));

    return NextResponse.json(formattedTunnels, { status: 200 });

  } catch (error: any) {
    console.error('Error in GET /api/servers/[id]/docker/tunnels:', error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}