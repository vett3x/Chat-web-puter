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
        console.log(`[SocketServer] SSH ready for ${connectionId}.`);
        ws.send('\r\n\x1b[32m[SERVER] Conexión SSH establecida.\x1b[0m\r\n');
        
        const command = `docker exec -it ${containerId} /bin/bash`;
        console.log(`[SocketServer] Executing command: ${command}`);
        ws.send(`\x1b[33m[SERVER] Ejecutando: ${command}\x1b[0m\r\n`);

        ssh.exec(command, { pty: true }, (err, stream) => {
          if (err) {
            console.error(`[SocketServer] SSH exec error for ${connectionId}:`, err);
            ws.send(`\r\n\x1b[31m[SERVER] Error al ejecutar comando en SSH: ${err.message}\x1b[0m\r\n`);
            ssh.end();
            return;
          }

          console.log(`[SocketServer] Docker exec stream started for ${connectionId}`);
          activeConnections.set(connectionId, { ws, ssh, stream });

          ws.onmessage = (event) => {
            stream.write(event.data as Buffer);
          };

          stream.on('data', (data: Buffer) => {
            ws.send(data);
          });

          stream.on('close', (code: number, signal: string) => {
            console.log(`[SocketServer] Stream closed for ${connectionId}. Code: ${code}, Signal: ${signal}`);
            ws.send(`\r\n\x1b[33m[SERVER] La sesión del contenedor ha finalizado.\x1b[0m\r\n`);
            ws.close();
          });

          stream.stderr.on('data', (data: Buffer) => {
            console.error(`[SocketServer] STDERR for ${connectionId}: ${data.toString()}`);
            ws.send(`\r\n\x1b[31m[SERVER-STDERR] ${data.toString()}\x1b[0m\r\n`);
          });
        });
      }).on('error', (err) => {
        console.error(`[SocketServer] SSH connection error for ${connectionId}:`, err);
        ws.send(`\r\n\x1b[31m[SERVER] Error de conexión SSH: ${err.message}\x1b[0m\r\n`);
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
      ws.send(`\r\n\x1b[31m[SERVER] Error: ${error.message}\x1b[0m\r\n`);
      ws.close();
    }
  });

  return wss;
}