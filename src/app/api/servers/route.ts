import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { provisionServer } from '@/lib/server-provisioning';

// Define SuperUser emails (for server-side check)
const SUPERUSER_EMAILS = ['martinpensa1@gmail.com'];

// Esquema de validación para añadir un servidor
const serverSchema = z.object({
  ip_address: z.string().ip({ message: 'Dirección IP inválida.' }),
  ssh_username: z.string().min(1, { message: 'El usuario SSH es requerido.' }),
  ssh_password: z.string().min(1, { message: 'La contraseña SSH es requerida.' }),
  ssh_port: z.coerce.number().int().min(1).max(65535).default(22).optional(),
  name: z.string().optional(),
});

// GET /api/servers - Obtener la lista de servidores registrados
export async function GET(req: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user?.email || !SUPERUSER_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  const { data: servers, error } = await supabase
    .from('user_servers')
    .select('id, name, ip_address, ssh_port, ssh_username, status, provisioning_log')
    .eq('user_id', session!.user.id);

  if (error) {
    console.error('Error fetching servers from Supabase:', JSON.stringify(error, null, 2));
    return NextResponse.json({ message: 'Error al cargar los servidores.' }, { status: 500 });
  }

  return NextResponse.json(servers, { status: 200 });
}

// POST /api/servers - Añadir un nuevo servidor y empezar el aprovisionamiento
export async function POST(req: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user?.email || !SUPERUSER_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const newServerData = serverSchema.parse(body);

    const { data: newServer, error } = await supabase
      .from('user_servers')
      .insert({
        user_id: session!.user.id,
        name: newServerData.name,
        ip_address: newServerData.ip_address,
        ssh_port: newServerData.ssh_port || 22,
        ssh_username: newServerData.ssh_username,
        ssh_password: newServerData.ssh_password,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting server into Supabase:', error);
      return NextResponse.json({ message: 'Error al guardar el servidor.' }, { status: 500 });
    }

    // Start provisioning in the background (don't await)
    provisionServer(newServer);

    return NextResponse.json(
      { message: 'Servidor añadido. El aprovisionamiento ha comenzado en segundo plano.', server: newServer },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error('Error al añadir servidor:', error);
    return NextResponse.json({ message: 'Error interno del servidor.' }, { status: 500 });
  }
}

// DELETE /api/servers - Eliminar un servidor
export async function DELETE(req: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user?.email || !SUPERUSER_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'ID de servidor no proporcionado.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('user_servers')
    .delete()
    .eq('id', id)
    .eq('user_id', session!.user.id);

  if (error) {
    console.error('Error deleting server from Supabase:', error);
    return NextResponse.json({ message: 'Error al eliminar el servidor.' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Servidor eliminado correctamente.' }, { status: 200 });
}