import { WebSocketServer, WebSocket } from 'ws';
import { createClient } from '@supabase/supabase-js';
import { Client as SshClient } from 'ssh2';
import type { ClientChannel } from 'ssh2';
import url from 'url';
import type { IncomingMessage } from 'http';

// This is a simple in-memory store. In a real-world scalable app, you'd use Redis or similar.
const activeConnections = new Map<string, { ws: WebSocket; ssh: SshClient; stream: ClientChannel }>();

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export function setupWebSocketServer(port: number) {
  const wss = new WebSocketServer({ port });
  console.log(`[SocketServer] WebSocket server started on port ${port}`);

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const connectionId = Math.random().toString(36).substring(7);
    console.log(`[SocketServer] Client connected: ${connectionId}`);

    const { query } = url.parse(req.url || '', true);
    const { serverId, containerId, userId } = query;

    if (typeof serverId !== 'string' || typeof containerId !== 'string' || typeof userId !== 'string') {
      console.error('[SocketServer] Missing serverId, containerId, or userId in connection query.');
      ws.send('Error: Faltan parámetros de conexión.\n');
      ws.close();
      return;
    }

    try {
      // Fetch server credentials securely from the backend
      const { data: server, error: fetchError } = await supabaseAdmin
        .from('user_servers')
        .select('ip_address, ssh_port, ssh_username, ssh_password')
        .eq('id', serverId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !server) {
        throw new Error('Servidor no encontrado o acceso denegado.');
      }

      const ssh = new SshClient();
      ssh.on('ready', () => {
        ws.send('Conexión SSH establecida. Iniciando shell en el contenedor...\r\n');
        ssh.exec(`docker exec -it ${containerId} /bin/sh`, (err, stream) => {
          if (err) {
            throw err;
          }

          activeConnections.set(connectionId, { ws, ssh, stream });

          ws.onmessage = (event) => {
            stream.write(event.data);
          };

          stream.on('data', (data: Buffer) => {
            ws.send(data);
          });

          stream.on('close', () => {
            console.log(`[SocketServer] Stream closed for ${connectionId}`);
            ws.close();
          });
        });
      }).on('error', (err) => {
        console.error(`[SocketServer] SSH connection error for ${connectionId}:`, err);
        ws.send(`\r\nError de conexión SSH: ${err.message}\r\n`);
        ws.close();
      }).connect({
        host: server.ip_address,
        port: server.ssh_port || 22,
        username: server.ssh_username,
        password: server.ssh_password,
      });

      ws.onclose = () => {
        console.log(`[SocketServer] Client disconnected: ${connectionId}`);
        const conn = activeConnections.get(connectionId);
        if (conn) {
          conn.stream.end();
          conn.ssh.end();
          activeConnections.delete(connectionId);
        }
      };

    } catch (error: any) {
      console.error(`[SocketServer] Error during connection setup for ${connectionId}:`, error);
      ws.send(`\r\nError: ${error.message}\r\n`);
      ws.close();
    }
  });

  return wss;
}