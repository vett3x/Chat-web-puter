import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Client } from 'ssh2';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Almacenamiento temporal de servidores (¡solo para desarrollo, no para producción persistente!)
// Las credenciales SSH se almacenan aquí en memoria. Se perderán al reiniciar el servidor.
interface ServerConfig {
  id: string;
  name?: string;
  ip_address: string;
  ssh_username: string;
  ssh_password?: string; // Optional if using keys, but required for password auth
  ssh_port?: number; // Added SSH port
}

const registeredServers: ServerConfig[] = [];
let serverIdCounter = 1;

// Define SuperUser emails (for server-side check)
const SUPERUSER_EMAILS = ['martinpensa1@gmail.com']; // ¡Asegúrate de que este sea tu correo electrónico!

// Esquema de validación para añadir un servidor
const serverSchema = z.object({
  ip_address: z.string().ip({ message: 'Dirección IP inválida.' }),
  ssh_username: z.string().min(1, { message: 'El usuario SSH es requerido.' }),
  ssh_password: z.string().min(1, { message: 'La contraseña SSH es requerida.' }),
  ssh_port: z.coerce.number().int().min(1).max(65535).default(22).optional(), // Added SSH port
  name: z.string().optional(),
});

// Helper function to create Supabase client for API routes
async function getSupabaseServerClient() { // Made async
  const cookieStore = cookies(); // cookies() is synchronous, but awaiting it helps type inference

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          cookieStore.set(name, value, options);
        },
        remove: (name: string, options: CookieOptions) => {
          cookieStore.delete(name);
        },
      },
    }
  );
}

// Add a middleware-like check for SuperUser
async function authorizeSuperUser() {
  const supabase = await getSupabaseServerClient(); // Await the call
  const { data: { session } } = await supabase.auth.getSession();

  if (!session || !session.user?.email || !SUPERUSER_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ message: 'Acceso denegado. Se requiere ser SuperUsuario.' }, { status: 403 });
  }
  return null; // Authorized
}

// GET /api/servers - Obtener la lista de servidores registrados (sin credenciales sensibles)
export async function GET(req: Request) {
  const authError = await authorizeSuperUser();
  if (authError) return authError;

  // Include ssh_port in the safeServers response
  const safeServers = registeredServers.map(({ id, name, ip_address, ssh_port }) => ({ id, name, ip_address, ssh_port }));
  return NextResponse.json(safeServers);
}

// POST /api/servers - Añadir un nuevo servidor
export async function POST(req: Request) {
  const authError = await authorizeSuperUser();
  if (authError) return authError;

  try {
    const body = await req.json();
    const newServerData = serverSchema.parse(body);

    // Simulate SSH connection test (optional, but good practice)
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
        port: newServerData.ssh_port || 22, // Use provided port or default to 22
        username: newServerData.ssh_username,
        password: newServerData.ssh_password,
        readyTimeout: 5000, // 5 seconds timeout
      });
    });

    if (!connectionSuccessful) {
      return NextResponse.json(
        { message: `Fallo la conexión SSH al servidor: ${connectionError || 'Credenciales incorrectas o servidor inaccesible.'}` },
        { status: 400 }
      );
    }

    const newServer: ServerConfig = {
      id: `srv-${serverIdCounter++}`,
      ...newServerData,
    };
    registeredServers.push(newServer);
    console.log('Servidor añadido (en memoria):', newServer.name || newServer.ip_address);

    return NextResponse.json(
      { message: 'Servidor añadido y conexión SSH verificada correctamente.', server: { id: newServer.id, name: newServer.name, ip_address: newServer.ip_address, ssh_port: newServer.ssh_port } },
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

// DELETE /api/servers/[id] - Eliminar un servidor
export async function DELETE(req: Request) {
  const authError = await authorizeSuperUser();
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'ID de servidor no proporcionado.' }, { status: 400 });
  }

  const initialLength = registeredServers.length;
  const serverIndex = registeredServers.findIndex(s => s.id === id);

  if (serverIndex === -1) {
    return NextResponse.json({ message: 'Servidor no encontrado.' }, { status: 404 });
  }

  registeredServers.splice(serverIndex, 1);

  if (registeredServers.length < initialLength) {
    console.log('Servidor eliminado (en memoria):', id);
    return NextResponse.json({ message: 'Servidor eliminado correctamente.' }, { status: 200 });
  } else {
    return NextResponse.json({ message: 'Error al eliminar el servidor.' }, { status: 500 });
  }
}

// Las siguientes funciones deben ser movidas a sus propios archivos de ruta en Next.js App Router.
// Por ejemplo, GET_SERVER_DETAILS debería estar en src/app/api/servers/[id]/details/route.ts como una función 'GET'.
/*
export async function GET_SERVER_DETAILS(req: Request) {
  const authError = await authorizeSuperUser();
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'ID de servidor no proporcionado.' }, { status: 400 });
  }

  const server = registeredServers.find(s => s.id === id);

  if (!server) {
    return NextResponse.json({ message: 'Servidor no encontrado.' }, { status: 404 });
  }

  // Placeholder for actual server details. In a real app, this would involve SSH commands.
  const details = {
    id: server.id,
    name: server.name,
    ip_address: server.ip_address,
    status: 'Online',
    cpu_usage: '25%',
    ram_usage: '4GB / 16GB',
    disk_usage: '100GB / 500GB',
    running_dockers: 3,
    web_links: [
      { name: 'App Demo', url: `http://${server.ip_address}:3000`, status: 'Running' },
      { name: 'Admin Panel', url: `http://${server.ip_address}:8080`, status: 'Offline' },
    ],
    last_updated: new Date().toISOString(),
  };

  return NextResponse.json(details);
}

export async function GET_SERVER_DOCKER(req: Request) {
  const authError = await authorizeSuperUser();
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'ID de servidor no proporcionado.' }, { status: 400 });
  }

  const server = registeredServers.find(s => s.id === id);

  if (!server) {
    return NextResponse.json({ message: 'Servidor no encontrado.' }, { status: 404 });
  }

  // Placeholder for actual Docker command execution via SSH
  const dockerContainers = [
    { id: 'c1', name: 'web-app', image: 'nginx:latest', status: 'running', ports: '80:80', cpu: '5%', mem: '100MB' },
    { id: 'c2', name: 'database', image: 'postgres:14', status: 'running', ports: '5432:5432', cpu: '10%', mem: '250MB' },
    { id: 'c3', name: 'redis', image: 'redis:latest', status: 'exited', ports: '6379:6379', cpu: '0%', mem: '0MB' },
  ];

  return NextResponse.json(dockerContainers);
}

export async function GET_SERVER_USAGE(req: Request) {
  const authError = await authorizeSuperUser();
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'ID de servidor no proporcionado.' }, { status: 400 });
  }

  const server = registeredServers.find(s => s.id === id);

  if (!server) {
    return NextResponse.json({ message: 'Servidor no encontrado.' }, { status: 404 });
  }

  // Placeholder for actual usage history data
  const usageHistory = [
    { timestamp: new Date(Date.now() - 3600000).toISOString(), cpu: 20, ram: 300, disk: 50 },
    { timestamp: new Date(Date.now() - 1800000).toISOString(), cpu: 25, ram: 320, disk: 51 },
    { timestamp: new Date().toISOString(), cpu: 22, ram: 310, disk: 50 },
  ];

  return NextResponse.json(usageHistory);
}

export async function POST_CLOUDFLARE_TUNNEL(req: Request) {
  const authError = await authorizeSuperUser();
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'ID de servidor no proporcionado.' }, { status: 400 });
  }

  const server = registeredServers.find(s => s.id === id);

  if (!server) {
    return NextResponse.json({ message: 'Servidor no encontrado.' }, { status: 404 });
  }

  const { action, tunnelId, secret } = await req.json(); // Example payload

  // Placeholder for actual Cloudflare Tunnel management via SSH
  let message = `Acción '${action}' para Cloudflare Tunnel en ${server.name || server.ip_address} (ID: ${id}).`;
  if (action === 'create') {
    message += ' Tunnel creado con éxito.';
  } else if (action === 'delete') {
    message += ' Tunnel eliminado con éxito.';
  } else if (action === 'status') {
    message += ' Estado del Tunnel: Activo.';
  }

  return NextResponse.json({ message, status: 'success' });
}
*/