export const runtime = 'nodejs'; // Force Node.js runtime

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Define SuperUser emails
const SUPERUSER_EMAILS = ['martinpensa1@gmail.com'];

// Esquema de validación para añadir un dominio de Cloudflare
const cloudflareDomainSchema = z.object({
  domain_name: z.string().min(1, { message: 'El nombre de dominio es requerido.' }).regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, { message: 'Formato de dominio inválido.' }),
  api_token: z.string().min(1, { message: 'El API Token es requerido.' }),
  zone_id: z.string().min(1, { message: 'El Zone ID es requerido.' }),
});

// Helper function to get the session
async function getSession() {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // In a Route Handler, the cookie store is read-only.
        },
        remove(name: string, options: CookieOptions) {
          // In a Route Handler, the cookie store is read-only.
        },
      },
    }
  );
  return supabase.auth.getSession();
}

// GET /api/cloudflare/domains - Obtener la lista de dominios de Cloudflare registrados
export async function GET(req: NextRequest) {
  const { data: { session } } = await getSession();
  if (!session || !session.user?.email || !SUPERUSER_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables.');
    return NextResponse.json({ message: 'Error de configuración del servidor: Clave de servicio de Supabase no encontrada.' }, { status: 500 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: domains, error } = await supabaseAdmin
    .from('cloudflare_domains')
    .select('id, domain_name, zone_id, created_at') // Do not return api_token for security
    .eq('user_id', session.user.id);

  if (error) {
    console.error('Error fetching Cloudflare domains from Supabase (admin):', JSON.stringify(error, null, 2));
    return NextResponse.json({ message: 'Error al cargar los dominios de Cloudflare.' }, { status: 500 });
  }

  return NextResponse.json(domains, { status: 200 });
}

// POST /api/cloudflare/domains - Añadir un nuevo dominio de Cloudflare
export async function POST(req: NextRequest) {
  const { data: { session } } = await getSession();
  if (!session || !session.user?.email || !SUPERUSER_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables.');
    return NextResponse.json({ message: 'Error de configuración del servidor: Clave de servicio de Supabase no encontrada.' }, { status: 500 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const body = await req.json();
    const newDomainData = cloudflareDomainSchema.parse(body);

    const { data: existingDomain, error: checkError } = await supabaseAdmin
      .from('cloudflare_domains')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('domain_name', newDomainData.domain_name)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means "no rows found"
      console.error('Error checking for existing domain:', checkError);
      return NextResponse.json({ message: 'Error al verificar el dominio existente.' }, { status: 500 });
    }

    if (existingDomain) {
      return NextResponse.json({ message: 'Este dominio ya está registrado.' }, { status: 409 });
    }

    const { data: newDomain, error } = await supabaseAdmin
      .from('cloudflare_domains')
      .insert({
        user_id: session.user.id,
        domain_name: newDomainData.domain_name,
        api_token: newDomainData.api_token, // Storing as plain text as per user's request
        zone_id: newDomainData.zone_id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting Cloudflare domain into Supabase (admin):', error);
      return NextResponse.json({ message: 'Error al guardar el dominio de Cloudflare.' }, { status: 500 });
    }

    return NextResponse.json(
      { message: 'Dominio de Cloudflare añadido correctamente.', domain: newDomain },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error('Error al añadir dominio de Cloudflare:', error);
    return NextResponse.json({ message: 'Error interno del servidor.' }, { status: 500 });
  }
}

// DELETE /api/cloudflare/domains - Eliminar un dominio de Cloudflare
export async function DELETE(req: NextRequest) {
  const { data: { session } } = await getSession();
  if (!session || !session.user?.email || !SUPERUSER_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'ID de dominio no proporcionado.' }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables.');
    return NextResponse.json({ message: 'Error de configuración del servidor: Clave de servicio de Supabase no encontrada.' }, { status: 500 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check if there are any tunnels associated with this domain
  const { count: tunnelsCount, error: tunnelsError } = await supabaseAdmin
    .from('docker_tunnels')
    .select('id', { count: 'exact', head: true })
    .eq('cloudflare_domain_id', id)
    .eq('user_id', session.user.id);

  if (tunnelsError) {
    console.error('Error checking for associated tunnels:', tunnelsError);
    return NextResponse.json({ message: 'Error al verificar túneles asociados.' }, { status: 500 });
  }

  if (tunnelsCount && tunnelsCount > 0) {
    return NextResponse.json({ message: `No se puede eliminar el dominio porque tiene ${tunnelsCount} túnel(es) Docker asociados. Elimina los túneles primero.` }, { status: 409 });
  }

  const { error } = await supabaseAdmin
    .from('cloudflare_domains')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id); // Still check user_id for safety

  if (error) {
    console.error('Error deleting Cloudflare domain from Supabase (admin):', error);
    return NextResponse.json({ message: 'Error al eliminar el dominio de Cloudflare.' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Dominio de Cloudflare eliminado correctamente.' }, { status: 200 });
}