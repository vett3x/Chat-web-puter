import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Client } from 'ssh2'; // Import the Client from ssh2

// Almacenamiento temporal de servidores (¡solo para desarrollo, no para producción persistente!)
// Las credenciales SSH se almacenan aquí en memoria. Se perderán al reiniciar el servidor.
interface ServerConfig {
  id: string;
  name?: string;
  ip_address: string;
  ssh_username: string;
  ssh_password?: string; // Optional if using keys, but required for password auth
}

const registeredServers: ServerConfig[] = [];
let serverIdCounter = 1;

// Esquema de validación para añadir un servidor
const serverSchema = z.object({
  ip_address: z.string().ip({ message: 'Dirección IP inválida.' }),
  ssh_username: z.string().min(1, { message: 'El usuario SSH es requerido.' }),
  ssh_password: z.string().min(1, { message: 'La contraseña SSH es requerida.' }),
  name: z.string().optional(),
});

// GET /api/servers - Obtener la lista de servidores registrados (sin credenciales sensibles)
export async function GET() {
  const safeServers = registeredServers.map(({ id, name, ip_address }) => ({ id, name, ip_address }));
  return NextResponse.json(safeServers);
}

// POST /api/servers - Añadir un nuevo servidor
export async function POST(req: Request) {
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
        port: 22,
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
      { message: 'Servidor añadido y conexión SSH verificada correctamente.', server: { id: newServer.id, name: newServer.name, ip_address: newServer.ip_address } },
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