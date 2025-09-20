import { WebSocketServer, WebSocket } from 'ws';
import { createClient } from '@supabase/supabase-js';
import { Client as SshClient } from 'ssh2';
import type { ClientChannel } from 'ssh2';
import url from 'url';
import type { IncomingMessage } from 'http';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: '.env.local' }); // Adjust path if your .env is elsewhere

const WS_PORT = 3001;

// This is a simple in-memory store. In a real-world scalable app, you'd use Redis or similar.
const activeConnections = new Map<string, { ws: WebSocket; ssh: SshClient; stream: ClientChannel }>();

// Initialize Supabase client with the service role key
// This allows us to bypass RLS and update the server status from the backend.
// IMPORTANT: Ensure SUPABASE_SERVICE_ROLE_KEY is set in your environment variables.
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[SocketServer] ERROR: SUPABASE_SERVICE_ROLE_KEY is not set. SSH connections will fail.');
  process.exit(1); // Exit if critical key is missing
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('[SocketServer] ERROR: NEXT_PUBLIC_SUPABASE_URL is not set. Supabase client cannot be initialized.');
  process.exit(1); // Exit if critical key is missing
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function setupWebSocketServer(port: number) {
  const wss = new WebSocketServer({ port });
  console.log(`[SocketServer] WebSocket server started on port ${port}`);

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const connectionId = Math.random().toString(36).substring(7);
    console.log(`[SocketServer] Client connected: ${connectionId}`);

    const { query } = url.parse(req.url || '', true);
    const { serverId, containerId, userId } = query;

    if (typeof serverId !== 'string' || typeof containerId !== 'string' || typeof userId !== 'string') {
      console.error(`[SocketServer] ${connectionId} ERROR: Missing serverId, containerId, or userId in connection query. Query:`, query);
      ws.send('Error: Faltan parámetros de conexión (serverId, containerId, userId).\n');
      ws.close();
      return;
    }
    console.log(`[SocketServer] ${connectionId} Connection parameters: serverId=${serverId}, containerId=${containerId}, userId=${userId}`);

    try {
      // Fetch server credentials securely from the backend
      const { data: server, error: fetchError } = await supabaseAdmin
        .from('user_servers')
        .select('ip_address, ssh_port, ssh_username, ssh_password')
        .eq('id', serverId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !server) {
        console.error(`[SocketServer] ${connectionId} ERROR: Server ${serverId} not found for user ${userId} or access denied. Supabase error:`, fetchError);
        throw new Error('Servidor no encontrado o acceso denegado. Verifica que el servidor exista y que tengas permisos.');
      }
      console.log(`[SocketServer] ${connectionId} Fetched server details for IP: ${server.ip_address}, User: ${server.ssh_username}`);

      const ssh = new SshClient();
      ssh.on('ready', () => {
        console.log(`[SocketServer] ${connectionId} SSH connection successful to ${server.ip_address}:${server.ssh_port}.`);
        ws.send('\r\n\x1b[32m[SERVER] Conexión SSH establecida.\x1b[0m\r\n');
        
        const command = `docker exec -it ${containerId} /bin/bash`;
        console.log(`[SocketServer] ${connectionId} Executing command: ${command}`);
        ws.send(`\x1b[33m[SERVER] Ejecutando: ${command}\x1b[0m\r\n`);

        ssh.exec(command, { pty: true }, (err, stream) => {
          if (err) {
            console.error(`[SocketServer] ${connectionId} ERROR: SSH exec error for command "${command}":`, err);
            ws.send(`\r\n\x1b[31m[SERVER] Error al ejecutar comando en SSH: ${err.message}\x1b[0m\r\n`);
            ssh.end();
            return;
          }

          console.log(`[SocketServer] ${connectionId} Docker exec stream started.`);
          activeConnections.set(connectionId, { ws, ssh, stream });

          ws.onmessage = (event) => {
            stream.write(event.data as Buffer);
          };

          stream.on('data', (data: Buffer) => {
            ws.send(data);
          });

          stream.on('close', (code: number, signal: string) => {
            console.log(`[SocketServer] ${connectionId} Stream closed. Code: ${code}, Signal: ${signal}`);
            ws.send(`\r\n\x1b[33m[SERVER] La sesión del contenedor ha finalizado (código: ${code}).\x1b[0m\r\n`);
            ws.close();
          });

          stream.stderr.on('data', (data: Buffer) => {
            console.error(`[SocketServer] ${connectionId} STDERR from Docker exec: ${data.toString()}`);
            ws.send(`\r\n\x1b[31m[SERVER-STDERR] ${data.toString()}\x1b[0m\r\n`);
          });
        });
      }).on('error', (err) => {
        console.error(`[SocketServer] ${connectionId} ERROR: SSH connection error to ${server.ip_address}:${server.ssh_port}:`, err);
        ws.send(`\r\n\x1b[31m[SERVER] Error de conexión SSH: ${err.message}\x1b[0m\r\n`);
        ws.send(`\x1b[31m[SERVER] Verifica la IP, puerto, usuario y contraseña SSH. Asegúrate de que el servidor SSH esté accesible y que no haya firewalls bloqueando el puerto ${server.ssh_port}.\x1b[0m\r\n`);
        ws.close();
      }).connect({
        host: server.ip_address,
        port: server.ssh_port || 22,
        username: server.ssh_username,
        password: server.ssh_password,
        readyTimeout: 20000, // Increased timeout for connection
      });

      ws.onclose = () => {
        console.log(`[SocketServer] ${connectionId} Client disconnected.`);
        const conn = activeConnections.get(connectionId);
        if (conn) {
          conn.stream.end();
          conn.ssh.end();
          activeConnections.delete(connectionId);
        }
      };

    } catch (error: any) {
      console.error(`[SocketServer] ${connectionId} ERROR during connection setup:`, error);
      ws.send(`\r\n\x1b[31m[SERVER] Error: ${error.message}\x1b[0m\r\n`);
      ws.close();
    }
  });

  return wss;
}

setupWebSocketServer(WS_PORT);