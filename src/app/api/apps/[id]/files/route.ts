export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { executeSshCommand } from '@/lib/ssh-utils';
import { getAppAndServerForFileOps } from '@/lib/app-state-manager';
import path from 'path';
import { Client as SshClient } from 'ssh2';

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function getUserId() {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { get: (name: string) => cookieStore.get(name)?.value } });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Acceso denegado.');
  return session.user.id;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

function buildFileTree(paths: string[]): FileNode[] {
  const root: FileNode = { name: 'root', path: '', type: 'directory', children: [] };
  for (const path of paths) {
    if (!path) continue;
    const parts = path.replace('./', '').split('/');
    let currentNode = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      let childNode = currentNode.children?.find(child => child.name === part);
      if (!childNode) {
        const isDirectory = i < parts.length - 1 || !path.includes('.');
        childNode = {
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          type: isDirectory ? 'directory' : 'file',
          children: isDirectory ? [] : undefined,
        };
        currentNode.children?.push(childNode);
      }
      currentNode = childNode;
    }
  }
  return root.children || [];
}

export async function GET(req: NextRequest, context: any) {
  const appId = context.params.id;
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get('path');

  try {
    const userId = await getUserId();
    const { app, server } = await getAppAndServerForFileOps(appId, userId);
    
    if (filePath) {
      // --- GET SINGLE FILE CONTENT ---
      const safeBasePath = '/app';
      const resolvedPath = path.join(safeBasePath, filePath);
      if (!resolvedPath.startsWith(safeBasePath + path.sep) && resolvedPath !== safeBasePath) {
        throw new Error(`Acceso denegado: La ruta '${filePath}' está fuera del directorio permitido.`);
      }
      const command = `cat '${resolvedPath}'`;
      const { stdout, stderr, code } = await executeSshCommand(server, `docker exec ${app.container_id} bash -c "${command}"`);
      if (code !== 0) throw new Error(`Error al leer el archivo: ${stderr}`);
      return NextResponse.json({ content: stdout });
    } else {
      // --- GET FILE TREE ---
      const command = `find /app -path /app/node_modules -prune -o -path /app/.next -prune -o -path /app/dev.log -prune -o -path /app/cloudflared.log -prune -o -print`;
      const { stdout, stderr, code } = await executeSshCommand(server, `docker exec ${app.container_id} bash -c "${command}"`);
      if (code !== 0) throw new Error(`Error al listar archivos: ${stderr}`);
      const paths = stdout.trim().split('\n').map(p => p.replace('/app/', '')).filter(p => p && p !== '/app');
      const fileTree = buildFileTree(paths);
      return NextResponse.json(fileTree);
    }
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// POST: Escribir MÚLTIPLES archivos en una sola conexión
export async function POST(req: NextRequest, context: any) {
  const appId = context.params.id;
  
  const conn = new SshClient();
  try {
    const userId = await getUserId();
    const { app, server } = await getAppAndServerForFileOps(appId, userId);
    const { files } = await req.json();

    console.log(`[API /apps/${appId}/files POST] Received ${files.length} files for writing.`);

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ message: 'Se requiere una lista de archivos.' }, { status: 400 });
    }

    // --- Conexión SSH Única ---
    console.log(`[API /apps/${appId}/files POST] Attempting SSH connection to ${server.ip_address}:${server.ssh_port} as ${server.ssh_username}...`);
    await new Promise<void>((resolve, reject) => {
      conn.on('ready', () => {
        console.log(`[API /apps/${appId}/files POST] SSH connection established.`);
        resolve();
      }).on('error', (err) => {
        console.error(`[API /apps/${appId}/files POST] SSH connection error:`, err);
        reject(new Error(`Error de conexión SSH: ${err.message}`));
      }).connect({
        host: server.ip_address,
        port: server.ssh_port || 22,
        username: server.ssh_username,
        password: server.ssh_password,
        readyTimeout: 10000,
      });
    });

    const backups = [];
    const logEntries = [];

    for (const file of files) {
      const { filePath, content } = file;
      if (!filePath || content === undefined) continue;

      const safeBasePath = '/app';
      const resolvedPath = path.join(safeBasePath, filePath);
      if (!resolvedPath.startsWith(safeBasePath + path.sep) && resolvedPath !== safeBasePath) {
        console.warn(`[API /apps/${appId}/files POST] Skipping unsafe file path: ${filePath}`);
        logEntries.push({
          user_id: userId,
          server_id: server.id,
          event_type: 'file_write_failed',
          description: `Intento de escritura de archivo con ruta insegura: '${filePath}'.`,
        });
        continue;
      }
      const directoryInContainer = path.dirname(resolvedPath);

      try {
        // 1. Crear directorios
        const mkdirCommand = `mkdir -p '${directoryInContainer}'`;
        console.log(`[API /apps/${appId}/files POST] Executing mkdir: docker exec ${app.container_id} bash -c "${mkdirCommand}"`);
        await executeSshOnExistingConnection(conn, `docker exec ${app.container_id} bash -c "${mkdirCommand}"`);
        console.log(`[API /apps/${appId}/files POST] Directories created for ${filePath}.`);

        // 2. Escribir archivo (Método robusto usando pipe y Base64)
        const encodedContent = Buffer.from(content).toString('base64');
        const writeCommand = `echo '${encodedContent}' | docker exec -i ${app.container_id} bash -c "base64 -d > '${resolvedPath}'"`;
        console.log(`[API /apps/${appId}/files POST] Executing write for ${filePath}: docker exec -i ${app.container_id} bash -c "base64 -d > '${resolvedPath}'"`);
        await executeSshOnExistingConnection(conn, writeCommand);
        console.log(`[API /apps/${appId}/files POST] File ${filePath} written successfully.`);
        
        // 3. Preparar para respaldo en DB
        backups.push({
          app_id: appId,
          user_id: userId,
          file_path: filePath,
          file_content: content,
        });

        // 4. Preparar entrada de log
        logEntries.push({
          user_id: userId,
          server_id: server.id,
          event_type: 'file_written',
          description: `Archivo '${filePath}' escrito en el contenedor ${app.container_id.substring(0, 12)}.`,
        });
      } catch (fileWriteError: any) {
        console.error(`[API /apps/${appId}/files POST] Error writing file ${filePath}:`, fileWriteError);
        logEntries.push({
          user_id: userId,
          server_id: server.id,
          event_type: 'file_write_failed',
          description: `Fallo al escribir archivo '${filePath}'. Error: ${fileWriteError.message}`,
        });
        // Continue to next file, but the overall operation will be marked as failed by the client if any file fails.
      }
    }

    // 5. Insertar logs y respaldos en paralelo
    await Promise.all([
      supabaseAdmin.from('app_file_backups').upsert(backups, { onConflict: 'app_id, file_path' }),
      supabaseAdmin.from('server_events_log').insert(logEntries)
    ]);

    return NextResponse.json({ message: 'Archivos guardados y respaldados correctamente.' });
  } catch (error: any) {
    console.error(`[API /apps/${appId}/files POST] Unhandled error:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  } finally {
    conn.end(); // Asegurarse de cerrar la conexión
    console.log(`[API /apps/${appId}/files POST] SSH connection closed.`);
  }
}

// Helper para ejecutar comandos en una conexión SSH ya abierta
function executeSshOnExistingConnection(conn: SshClient, command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('data', (data: Buffer) => { stdout += data.toString(); });
      stream.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
      stream.on('close', (code: number) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr.trim()}`));
        }
      });
    });
  });
}