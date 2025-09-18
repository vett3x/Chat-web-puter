import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { Client } from 'ssh2';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import CryptoJS from 'crypto-js';

// Define SuperUser emails (for server-side check)
const SUPERUSER_EMAILS = ['martinpensa1@gmail.com']; // ¡Asegúrate de que este sea tu correo electrónico!

// Esquema de validación para añadir un servidor
const serverSchema = z.object({
  ip_address: z.string().ip({ message: 'Dirección IP inválida.' }),
  ssh_username: z.string().min(1, { message: 'El usuario SSH es requerido.' }),
  ssh_password: z.string().min(1, { message: 'La contraseña SSH es requerida.' }),
  ssh_port: z.coerce.number().int().min(1).max(65535).default(22).optional(),
  name: z.string().optional(),
});

// Encryption/Decryption functions
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'super-secret-key-please-change-me'; // Fallback for dev, MUST be set in production

function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
}

function decrypt(ciphertext: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

// Helper function to create Supabase client for API routes
// Esta función ahora toma un objeto NextResponse para modificar sus cookies y es SÍNCRONA.
function getSupabaseServerClient(res: NextResponse) {
  // No necesitamos una variable cookieStore aquí, ya que cookies() se llamará directamente en el 'get'.

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookies().get(name)?.value, // Llamada directa a cookies().get()
        set: (name: string, value: string, options: CookieOptions) => {
          res.cookies.set({ name, value, ...options });
        },
        remove: (name: string, options: CookieOptions) => {
          res.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );
}

// Add a middleware-like check for SuperUser
async function authorizeSuperUser(res: NextResponse) {
  const supabase = getSupabaseServerClient(res);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session || !session.user?.email || !SUPERUSER_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ message: 'Acceso denegado. Se requiere ser SuperUsuario.' }, { status: 403 });
  }
  return null; // Authorized
}

// GET /api/servers - Obtener la lista de servidores registrados (sin credenciales sensibles)
export async function GET(req: NextRequest) {
  const res = NextResponse.json({});
  const authError = await authorizeSuperUser(res);
  if (authError) return authError;

  const supabase = getSupabaseServerClient(res);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ message: 'No autenticado.' }, { status: 401 });
  }

  const { data: servers, error } = await supabase
    .from('user_servers')
    .select('id, name, ip_address, ssh_port, ssh_username')
    .eq('user_id', session.user.id);

  if (error) {
    console.error('Error fetching servers from Supabase:', JSON.stringify(error, null, 2));
    return NextResponse.json({ message: 'Error al cargar los servidores.' }, { status: 500 });
  }

  return NextResponse.json(servers, { status: 200, headers: res.headers });
}

// POST /api/servers - Añadir un nuevo servidor
export async function POST(req: NextRequest) {
  const res = NextResponse.json({});
  const authError = await authorizeSuperUser(res);
  if (authError) return authError;

  const supabase = getSupabaseServerClient(res);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ message: 'No autenticado.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const newServerData = serverSchema.parse(body);

    const encryptedPassword = encrypt(newServerData.ssh_password);

    const conn = new Client();
    let connectionSuccessful = false;
    let connectionError: string | null = null;

    await new Promise<void>((resolve) => {
      conn.on('ready', () => {
        connectionSuccessful = true;
        conn.end();
        resolve();
      }).on('error', (err) => {
        connectionError = err.message;
        conn.end();
        resolve();
      }).connect({
        host: newServerData.ip_address,
        port: newServerData.ssh_port || 22,
        username: newServerData.ssh_username,
        password: decrypt(encryptedPassword),
        readyTimeout: 5000,
      });
    });

    if (!connectionSuccessful) {
      return NextResponse.json(
        { message: `Fallo la conexión SSH al servidor: ${connectionError || 'Credenciales incorrectas o servidor inaccesible.'}` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('user_servers')
      .insert({
        user_id: session.user.id,
        name: newServerData.name,
        ip_address: newServerData.ip_address,
        ssh_port: newServerData.ssh_port || 22,
        ssh_username: newServerData.ssh_username,
        encrypted_ssh_password: encryptedPassword,
      })
      .select('id, name, ip_address, ssh_port')
      .single();

    if (error) {
      console.error('Error inserting server into Supabase:', error);
      return NextResponse.json({ message: 'Error al guardar el servidor.' }, { status: 500 });
    }

    return NextResponse.json(
      { message: 'Servidor añadido y conexión SSH verificada correctamente.', server: data },
      { status: 201, headers: res.headers }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error('Error al añadir servidor:', error);
    return NextResponse.json({ message: 'Error interno del servidor.' }, { status: 500 });
  }
}

// DELETE /api/servers/[id] - Eliminar un servidor
export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({});
  const authError = await authorizeSuperUser(res);
  if (authError) return authError;

  const supabase = getSupabaseServerClient(res);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ message: 'No autenticado.' }, { status: 401 });
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
    .eq('user_id', session.user.id);

  if (error) {
    console.error('Error deleting server from Supabase:', error);
    return NextResponse.json({ message: 'Error al eliminar el servidor.' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Servidor eliminado correctamente.' }, { status: 200, headers: res.headers });
}