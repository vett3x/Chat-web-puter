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

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ message: 'Se requiere una lista de archivos.' }, { status: 400 });
    }

    // --- Conexión SSH Única ---
    console.log(`[API /apps/${appId}/files] Establishing SSH connection to ${server.ip_address}...`);
    await new Promise<void>((resolve, reject) => {
      conn.on('ready', () => {
        console.log(`[API /apps/${appId}/files] SSH connection ready.`);
        resolve();
      }).on('error', (err) => {
        console.error(`[API /apps/${appId}/files] SSH connection error:`, err);
        reject(err);
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
      if (!filePath || content === undefined) {
        console.warn(`[API /apps/${appId}/files] Skipping file due to missing path or content:`, file);
        continue;
      }

      const safeBasePath = '/app';
      const resolvedPath = path.join(safeBasePath, filePath);
      if (!resolvedPath.startsWith(safeBasePath + path.sep) && resolvedPath !== safeBasePath) {
        console.warn(`[API /apps/${appId}/files] Skipping unsafe file path: ${filePath}`);
        continue;
      }
      const directoryInContainer = path.dirname(resolvedPath);

      console.log(`[API /apps/${appId}/files] Processing file: ${filePath}`);

      // 1. Crear directorios
      const mkdirCommand = `mkdir -p '${directoryInContainer}'`;
      console.log(`[API /apps/${appId}/files] Executing mkdir: ${mkdirCommand}`);
      const mkdirResult = await executeSshOnExistingConnection(conn, `docker exec ${app.container_id} bash -c "${mkdirCommand}"`);
      if (mkdirResult.code !== 0) {
        console.error(`[API /apps/${appId}/files] mkdir failed for ${filePath}: STDERR: ${mkdirResult.stderr}`);
        throw new Error(`Error creating directory for ${filePath}: ${mkdirResult.stderr}`);
      }
      console.log(`[API /apps/${appId}/files] mkdir successful for ${filePath}.`);

      // 2. Escribir archivo (Método robusto usando pipe y Base64)
      const encodedContent = Buffer.from(content).toString('base64');
      const writeCommand = `echo '${encodedContent}' | docker exec -i ${app.container_id} bash -c "base64 -d > '${resolvedPath}'"`;
      console.log(`[API /apps/${appId}/files] Executing write command for ${filePath}. Content length: ${content.length}`);
      const writeResult = await executeSshOnExistingConnection(conn, writeCommand);
      if (writeResult.code !== 0) {
        console.error(`[API /apps/${appId}/files] Write failed for ${filePath}: STDERR: ${writeResult.stderr}`);
        throw new Error(`Error writing file ${filePath}: ${writeResult.stderr}`);
      }
      console.log(`[API /apps/${appId}/files] Write successful for ${filePath}.`);

      // 3. Verificar que el archivo se escribió correctamente
      const verifyCommand = `ls -l '${resolvedPath}' && cat '${resolvedPath}' | wc -c`;
      console.log(`[API /apps/${appId}/files] Verifying file: ${verifyCommand}`);
      const verifyResult = await executeSshOnExistingConnection(conn, `docker exec ${app.container_id} bash -c "${verifyCommand}"`);
      if (verifyResult.code !== 0) {
        console.error(`[API /apps/${appId}/files] Verification failed for ${filePath}: STDERR: ${verifyResult.stderr}`);
        throw new Error(`Error verifying file ${filePath}: ${verifyResult.stderr}`);
      }
      const [lsOutput, wcOutput] = verifyResult.stdout.split('\n');
      const fileSize = parseInt(wcOutput.trim(), 10);
      if (fileSize !== content.length) {
        console.error(`[API /apps/${appId}/files] File size mismatch for ${filePath}. Expected: ${content.length}, Actual: ${fileSize}`);
        throw new Error(`Error de verificación: el tamaño del archivo ${filePath} no coincide. Esperado: ${content.length}, Real: ${fileSize}`);
      }
      console.log(`[API /apps/${appId}/files] File ${filePath} verified. Size: ${fileSize} bytes.`);
      
      // 4. Preparar para respaldo en DB
      backups.push({
        app_id: appId,
        user_id: userId,
        file_path: filePath,
        file_content: content,
      });

      // 5. Preparar entrada de log
      logEntries.push({
        user_id: userId,
        server_id: server.id,
        event_type: 'file_written',
        description: `Archivo '${filePath}' escrito en el contenedor ${app.container_id.substring(0, 12)}.`,
      });
    }

    // 6. Insertar logs y respaldos en paralelo
    console.log(`[API /apps/${appId}/files] Inserting ${backups.length} backups and ${logEntries.length} log entries into Supabase.`);
    await Promise.all([
      supabaseAdmin.from('app_file_backups').upsert(backups, { onConflict: 'app_id, file_path' }),
      supabaseAdmin.from('server_events_log').insert(logEntries)
    ]);
    console.log(`[API /apps/${appId}/files] Supabase updates complete.`);

    return NextResponse.json({ message: 'Archivos guardados y respaldados correctamente.' });
  } catch (error: any) {
    console.error(`[API /apps/${appId}/files] Unhandled error in POST:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  } finally {
    console.log(`[API /apps/${appId}/files] Closing SSH connection.`);
    conn.end(); // Asegurarse de cerrar la conexión
  }
}

// Helper para ejecutar comandos en una conexión SSH ya abierta
function executeSshOnExistingConnection(conn: SshClient, command: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      let exitCode = 1; // Default to non-zero exit code for errors

      stream.on('data', (data: Buffer) => { stdout += data.toString(); });
      stream.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
      stream.on('close', (code: number) => {
        exitCode = code;
        resolve({ stdout, stderr, code: exitCode });
      });
    });
  });
}