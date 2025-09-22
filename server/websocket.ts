import { WebSocketServer, WebSocket } from 'ws';
import { createClient } from '@supabase/supabase-js';
import { Client as SshClient } from 'ssh2';
import type { ClientChannel } from 'ssh2';
import type { IncomingMessage } from 'http';
import { parse } from 'url';
import dotenv from 'dotenv';

// Load environment variables from the root .env.local file
dotenv.config({ path: '.env.local' });

const port = parseInt(process.env.WEBSOCKET_PORT || '3001', 10);
const wss = new WebSocketServer({ port });

console.log(`[WSS] WebSocket Server started on port ${port}`);

if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('[WSS] ERROR: Supabase environment variables are not set. Connections will fail.');
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const activeConnections = new Map<string, { ws: WebSocket; ssh: SshClient; stream: ClientChannel }>();

wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
  const connectionId = Math.random().toString(36).substring(7);
  console.log(`[WSS] Client connected: ${connectionId}`);

  const { query } = parse(req.url || '', true);
  const { serverId, containerId, userId } = query;

  if (typeof serverId !== 'string' || typeof containerId !== 'string' || typeof userId !== 'string') {
    console.error(`[WSS] ${connectionId} ERROR: Missing connection parameters. Query:`, query);
    ws.send('Error: Faltan parámetros de conexión (serverId, containerId, userId).\n');
    ws.close();
    return;
  }
  console.log(`[WSS] ${connectionId} Connection parameters: serverId=${serverId}, containerId=${containerId}, userId=${userId}`);

  try {
    const { data: server, error: fetchError } = await supabaseAdmin
      .from('user_servers')
      .select('ip_address, ssh_port, ssh_username, ssh_password')
      .eq('id', serverId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !server) {
      console.error(`[WSS] ${connectionId} ERROR: Server not found or access denied.`, fetchError);
      throw new Error('Servidor no encontrado o acceso denegado.');
    }

    const ssh = new SshClient();
    ssh.on('ready', () => {
      console.log(`[WSS] ${connectionId} SSH connection successful.`);
      ws.send('\r\n\x1b[32m[SERVER] Conexión SSH establecida.\x1b[0m\r\n');
      
      const command = `docker exec -it ${containerId} /bin/bash`;
      ssh.exec(command, { pty: true }, (err, stream) => {
        if (err) {
          console.error(`[WSS] ${connectionId} ERROR: SSH exec error:`, err);
          ws.send(`\r\n\x1b[31m[SERVER] Error al ejecutar comando en SSH: ${err.message}\x1b[0m\r\n`);
          ssh.end();
          return;
        }

        activeConnections.set(connectionId, { ws, ssh, stream });

        ws.onmessage = (event) => stream.write(event.data as Buffer);
        stream.on('data', (data: Buffer) => ws.send(data));
        stream.on('close', () => ws.close());
        stream.stderr.on('data', (data: Buffer) => ws.send(`\r\n\x1b[31m[STDERR] ${data.toString()}\x1b[0m\r\n`));
      });
    }).on('error', (err) => {
      console.error(`[WSS] ${connectionId} ERROR: SSH connection error:`, err);
      ws.send(`\r\n\x1b[31m[SERVER] Error de conexión SSH: ${err.message}\x1b[0m\r\n`);
      ws.close();
    }).connect({
      host: server.ip_address,
      port: server.ssh_port || 22,
      username: server.ssh_username,
      password: server.ssh_password,
      readyTimeout: 20000,
    });

    ws.onclose = () => {
      console.log(`[WSS] ${connectionId} Client disconnected.`);
      const conn = activeConnections.get(connectionId);
      if (conn) {
        conn.stream.end();
        conn.ssh.end();
        activeConnections.delete(connectionId);
      }
    };
  } catch (error: any) {
    console.error(`[WSS] ${connectionId} ERROR during setup:`, error);
    ws.send(`\r\n\x1b[31m[SERVER] Error: ${error.message}\x1b[0m\r\n`);
    ws.close();
  }
});