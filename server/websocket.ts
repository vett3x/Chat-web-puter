import { WebSocketServer, WebSocket } from 'ws';
import { createClient } from '@supabase/supabase-js';
import { Client as SshClientType, type ClientChannel, type ExecChannel } from 'ssh2'; // Import Client as value, others as types
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

const activeConnections = new Map<string, { ws: WebSocket; ssh: SshClientType; stream: ClientChannel }>();

wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
  const connectionId = Math.random().toString(36).substring(7);
  console.log(`[WSS] Client connected: ${connectionId}`);

  const { query } = parse(req.url || '', true);
  const { serverId, containerId, userId, mode } = query; // Add mode

  if (typeof serverId !== 'string' || typeof containerId !== 'string' || typeof userId !== 'string') {
    console.error(`[WSS] ${connectionId} ERROR: Missing connection parameters. Query:`, query);
    ws.send('\r\n\x1b[31m[SERVER] Error: Faltan parámetros de conexión (serverId, containerId, userId).\x1b[0m\r\n');
    ws.close();
    return;
  }
  console.log(`[WSS] ${connectionId} Connection parameters: serverId=${serverId}, containerId=${containerId}, userId=${userId}, mode=${mode || 'shell'}`);

  try {
    // 1. Fetch profile of the user trying to connect to determine their role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error(`[WSS] ${connectionId} ERROR: User profile not found for userId: ${userId}`, profileError);
      ws.send(`\r\n\x1b[31m[SERVER] Error: Perfil de usuario no encontrado.\x1b[0m\r\n`);
      ws.close();
      return;
    }
    const userRole = profile.role;

    // 2. Build the query for the server
    let serverQuery = supabaseAdmin
      .from('user_servers')
      .select('ip_address, ssh_port, ssh_username, ssh_password')
      .eq('id', serverId);

    // 3. If the user is NOT an admin or super_admin, scope the query to their own servers
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      serverQuery = serverQuery.eq('user_id', userId);
    }

    const { data: server, error: fetchError } = await serverQuery.single();

    if (fetchError || !server) {
      console.error(`[WSS] ${connectionId} ERROR: Server not found or access denied.`, fetchError);
      const errorMessage = fetchError ? fetchError.message : 'Servidor no encontrado o acceso denegado.';
      ws.send(`\r\n\x1b[31m[SERVER] Error: ${errorMessage}\x1b[0m\r\n`);
      ws.close();
      return;
    }
    console.log(`[WSS] ${connectionId} Server details fetched successfully. Attempting SSH connection to ${server.ip_address}:${server.ssh_port}`);

    const ssh = new SshClientType(); // Use SshClientType
    ssh.on('ready', () => {
      console.log(`[WSS] ${connectionId} SSH connection successful.`);
      
      let command: string;
      let pty: boolean;

      if (mode === 'logs') {
        command = `docker logs -f --tail="200" ${containerId}`;
        pty = false; // No pseudo-terminal needed for logs
        ws.send('\r\n\x1b[32m[SERVER] Conexión SSH establecida. Transmitiendo logs...\x1b[0m\r\n');
      } else { // Default to shell
        command = `docker exec -it ${containerId} /bin/bash`;
        pty = true;
        ws.send('\r\n\x1b[32m[SERVER] Conexión SSH establecida.\x1b[0m\r\n');
      }
      
      console.log(`[WSS] ${connectionId} Executing command: "${command}"`);
      ssh.exec(command, { pty }, (err: Error | undefined, stream: ExecChannel) => { // Explicitly type err and stream
        if (err) {
          console.error(`[WSS] ${connectionId} ERROR: SSH exec error:`, err);
          ws.send(`\r\n\x1b[31m[SERVER] Error al ejecutar comando en SSH: ${err.message}\x1b[0m\r\n`);
          ssh.end();
          return;
        }
        
        if (mode === 'logs') {
            console.log(`[WSS] ${connectionId} Docker logs stream opened.`);
        } else {
            console.log(`[WSS] ${connectionId} Docker exec stream opened.`);
        }

        activeConnections.set(connectionId, { ws, ssh, stream });

        // Only set onmessage for shell mode
        if (mode !== 'logs') {
            ws.onmessage = (event) => {
              stream.write(event.data as Buffer);
            };
        }

        stream.on('data', (data: Buffer) => {
          ws.send(data);
        });
        stream.on('close', () => {
          if (mode === 'logs') {
            console.log(`[WSS] ${connectionId} Docker logs stream closed.`);
          } else {
            console.log(`[WSS] ${connectionId} Docker exec stream closed.`);
          }
          ws.close();
        });
        stream.stderr.on('data', (data: Buffer) => {
          console.error(`[WSS] ${connectionId} STDERR from SSH command: ${data.toString()}`);
          // Send formatted error to client so they know it's not from the container's app
          ws.send(`\r\n\x1b[31m[SERVER ERROR] ${data.toString()}\x1b[0m\r\n`);
        });
      });
    }).on('error', (err: Error) => { // Explicitly type err
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