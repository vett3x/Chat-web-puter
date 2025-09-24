export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { executeSshCommand } from '@/lib/ssh-utils';
import { getAppAndServerForFileOps } from '@/lib/app-state-manager';
import path from 'path';
import { Client as SshClient } from 'ssh2';
import type { SFTPWrapper } from 'ssh2';
import { SUPERUSER_EMAILS, UserPermissions, PERMISSION_KEYS } from '@/lib/constants';

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function getUserId() {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { get: (name: string) => cookieStore.get(name)?.value } });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Acceso denegado.');
  return session.user.id;
}

// Helper function to get the session and user role and permissions
async function getSessionAndRole(): Promise<{ session: any; userRole: 'user' | 'admin' | 'super_admin' | null; userPermissions: UserPermissions }> {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) {},
        remove(name: string, options: CookieOptions) {},
      },
    }
  );
  const { data: { session } } = await supabase.auth.getSession();

  let userRole: 'user' | 'admin' | 'super_admin' | null = null;
  let userPermissions: UserPermissions = {};

  if (session?.user?.id) {
    // First, determine the role, prioritizing SUPERUSER_EMAILS
    if (session.user.email && SUPERUSER_EMAILS.includes(session.user.email)) {
      userRole = 'super_admin';
    } else {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      if (profile) {
        userRole = profile.role as 'user' | 'admin' | 'super_admin';
      } else {
        userRole = 'user';
      }
    }

    // Then, fetch permissions from profile, or set all if super_admin
    if (userRole === 'super_admin') {
      for (const key of Object.values(PERMISSION_KEYS)) {
        userPermissions[key] = true;
      }
    } else {
      const { data: profilePermissions, error: permissionsError } = await supabase
        .from('profiles')
        .select('permissions')
        .eq('id', session.user.id)
        .single();
      if (profilePermissions) {
        userPermissions = profilePermissions.permissions || {};
      } else {
        userPermissions = {
          [PERMISSION_KEYS.CAN_CREATE_SERVER]: false,
          [PERMISSION_KEYS.CAN_MANAGE_DOCKER_CONTAINERS]: false,
          [PERMISSION_KEYS.CAN_MANAGE_CLOUDFLARE_DOMAINS]: false,
          [PERMISSION_KEYS.CAN_MANAGE_CLOUDFLARE_TUNNELS]: false,
        };
      }
    }
  }
  return { session, userRole, userPermissions };
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

// POST: Escribir MÚLTIPLES archivos usando archivos temporales y docker cp
export async function POST(req: NextRequest, context: any) {
  const appId = context.params.id;
  
  const conn = new SshClient();
  let sftp: SFTPWrapper | undefined;
  try {
    const { session, userRole, userPermissions } = await getSessionAndRole();
    if (!session || !userRole) {
      return NextResponse.json({ message: 'Acceso denegado. No autenticado.' }, { status: 401 });
    }
    if (!userPermissions[PERMISSION_KEYS.CAN_MANAGE_DOCKER_CONTAINERS]) {
      return NextResponse.json({ message: 'Acceso denegado. No tienes permiso para gestionar contenedores Docker.' }, { status: 403 });
    }

    const userId = session.user.id;
    const { app, server } = await getAppAndServerForFileOps(appId, userId);
    const { files } = await req.json();

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ message: 'Se requiere una lista de archivos.' }, { status: 400 });
    }

    // --- Conexión SSH y SFTP ---
    console.log(`[API /apps/${appId}/files] Establishing SSH connection to ${server.ip_address}...`);
    await new Promise<void>((resolve, reject) => {
      conn.on('ready', () => {
        console.log(`[API /apps/${appId}/files] SSH connection ready.`);
        conn.sftp((err, sftpClient) => {
          if (err) {
            conn.end();
            return reject(new Error(`SFTP error: ${err.message}`));
          }
          sftp = sftpClient;
          resolve();
        });
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

    if (!sftp) {
      throw new Error('Failed to establish SFTP connection.');
    }

    const backups = [];
    const logEntries = [];
    const tempDir = `/tmp/docker-upload-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Crear directorio temporal en el host
    console.log(`[API /apps/${appId}/files] Creating temp directory: ${tempDir}`);
    const mkdirTempResult = await executeSshOnExistingConnection(conn, `mkdir -p ${tempDir}`);
    if (mkdirTempResult.code !== 0) {
      throw new Error(`Error creating temp directory: ${mkdirTempResult.stderr}`);
    }

    try {
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

        console.log(`[API /apps/${appId}/files] Processing file: ${filePath}`);

        // 1. Escribir archivo temporalmente en el host usando SFTP
        const tempFilePath = path.join(tempDir, path.basename(filePath));
        console.log(`[API /apps/${appId}/files] Writing temp file to host: ${tempFilePath}`);
        
        await new Promise<void>((resolve, reject) => {
          const writeStream = sftp!.createWriteStream(tempFilePath, { mode: 0o644 });
          writeStream.write(content);
          writeStream.end();
          writeStream.on('finish', resolve);
          writeStream.on('error', (writeErr: Error) => {
            console.error(`[API /apps/${appId}/files] SFTP write failed for temp file:`, writeErr);
            reject(new Error(`Error writing temp file: ${writeErr.message}`));
          });
        });

        // 2. Crear directorios en el contenedor si es necesario
        const directoryInContainer = path.dirname(resolvedPath);
        const mkdirCommand = `docker exec ${app.container_id} mkdir -p '${directoryInContainer}'`;
        console.log(`[API /apps/${appId}/files] Creating directory in container: ${directoryInContainer}`);
        const mkdirResult = await executeSshOnExistingConnection(conn, mkdirCommand);
        if (mkdirResult.code !== 0) {
          console.error(`[API /apps/${appId}/files] mkdir failed: ${mkdirResult.stderr}`);
          throw new Error(`Error creating directory: ${mkdirResult.stderr}`);
        }

        // 3. Copiar archivo del host al contenedor usando docker cp
        const dockerCpCommand = `docker cp '${tempFilePath}' '${app.container_id}:${resolvedPath}'`;
        console.log(`[API /apps/${appId}/files] Copying file to container: ${dockerCpCommand}`);
        const cpResult = await executeSshOnExistingConnection(conn, dockerCpCommand);
        if (cpResult.code !== 0) {
          console.error(`[API /apps/${appId}/files] docker cp failed: ${cpResult.stderr}`);
          throw new Error(`Error copying file to container: ${cpResult.stderr}`);
        }

        // 4. Verificar que el archivo se copió correctamente
        const verifyCommand = `docker exec ${app.container_id} bash -c "ls -la '${resolvedPath}' && cat '${resolvedPath}' | wc -c"`;
        console.log(`[API /apps/${appId}/files] Verifying file: ${verifyCommand}`);
        const verifyResult = await executeSshOnExistingConnection(conn, verifyCommand);
        if (verifyResult.code !== 0) {
          console.error(`[API /apps/${appId}/files] Verification failed: ${verifyResult.stderr}`);
          throw new Error(`Error verifying file: ${verifyResult.stderr}`);
        }
        
        const outputLines = verifyResult.stdout.trim().split('\n');
        const fileSize = parseInt(outputLines[outputLines.length - 1].trim(), 10);
        console.log(`[API /apps/${appId}/files] File verified. Size: ${fileSize} bytes (expected: ${content.length} bytes)`);
        
        if (fileSize !== content.length) {
          console.error(`[API /apps/${appId}/files] File size mismatch. Expected: ${content.length}, Actual: ${fileSize}`);
          throw new Error(`File size mismatch for ${filePath}`);
        }

        // 5. Preparar para respaldo en DB
        backups.push({
          app_id: appId,
          user_id: userId,
          file_path: filePath,
          file_content: content,
        });

        // 6. Preparar entrada de log
        logEntries.push({
          user_id: userId,
          server_id: server.id,
          event_type: 'file_written',
          description: `Archivo '${filePath}' escrito en el contenedor ${app.container_id.substring(0, 12)}.`,
        });
      }

      // 7. Limpiar directorio temporal
      console.log(`[API /apps/${appId}/files] Cleaning up temp directory: ${tempDir}`);
      await executeSshOnExistingConnection(conn, `rm -rf ${tempDir}`);

      // 8. Insertar logs y respaldos en paralelo
      console.log(`[API /apps/${appId}/files] Inserting ${backups.length} backups and ${logEntries.length} log entries into Supabase.`);
      await Promise.all([
        supabaseAdmin.from('app_file_backups').upsert(backups, { onConflict: 'app_id, file_path' }),
        supabaseAdmin.from('server_events_log').insert(logEntries)
      ]);

      return NextResponse.json({ message: 'Archivos guardados y respaldados correctamente.' });
    } catch (error) {
      // Intentar limpiar el directorio temporal en caso de error
      console.log(`[API /apps/${appId}/files] Error occurred, cleaning up temp directory: ${tempDir}`);
      await executeSshOnExistingConnection(conn, `rm -rf ${tempDir}`).catch(() => {});
      throw error;
    }
  } catch (error: any) {
    console.error(`[API /apps/${appId}/files] Unhandled error in POST:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  } finally {
    console.log(`[API /apps/${appId}/files] Closing connections.`);
    if (sftp) sftp.end();
    conn.end();
  }
}

// Helper para ejecutar comandos en una conexión SSH ya abierta
function executeSshOnExistingConnection(conn: SshClient, command: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      let exitCode = 1;

      stream.on('data', (data: Buffer) => { stdout += data.toString(); });
      stream.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
      stream.on('close', (code: number) => {
        exitCode = code;
        resolve({ stdout, stderr, code: exitCode });
      });
    });
  });
}