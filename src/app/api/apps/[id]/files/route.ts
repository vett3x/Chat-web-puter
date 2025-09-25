export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { executeSshCommand } from '@/lib/ssh-utils';
import { getAppAndServerForFileOps } from '@/lib/app-state-manager';
import path from 'path';
import { Client as SshClient } from 'ssh2';
import type { SFTPWrapper } from 'ssh2'; // Import SFTPWrapper type
import { SUPERUSER_EMAILS, UserPermissions, PERMISSION_KEYS } from '@/lib/constants'; // Importación actualizada

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
        .select('role') // Only need role for initial determination
        .eq('id', session.user.id)
        .single();
      if (profile) {
        userRole = profile.role as 'user' | 'admin' | 'super_admin';
      } else {
        userRole = 'user'; // Default to user if no profile found and not superuser email
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
        // Default permissions for non-super-admin if profile fetch failed
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

// POST: Escribir MÚLTIPLES archivos en una sola conexión usando `docker exec`
export async function POST(req: NextRequest, context: any) {
  const appId = context.params.id;
  
  const conn = new SshClient();
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

    // --- Conexión SSH Única ---
    await new Promise<void>((resolve, reject) => {
      conn.on('ready', resolve).on('error', reject).connect({
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
      const resolvedPath = path.posix.join(safeBasePath, filePath); // Use path.posix for consistent separators
      if (!resolvedPath.startsWith(safeBasePath + '/')) {
        console.warn(`[API /apps/${appId}/files] Skipping unsafe file path: ${filePath}`);
        continue;
      }
      const directoryInContainer = path.posix.dirname(resolvedPath);

      // 1. Crear directorios dentro del contenedor
      const mkdirCommand = `mkdir -p '${directoryInContainer}'`;
      const mkdirResult = await executeSshOnExistingConnection(conn, `docker exec ${app.container_id} bash -c "${mkdirCommand}"`);
      if (mkdirResult.code !== 0) throw new Error(`Error creating directory for ${filePath}: ${mkdirResult.stderr}`);

      // 2. Escribir archivo usando `docker exec` con Base64
      const encodedContent = Buffer.from(content).toString('base64');
      const writeCommand = `echo '${encodedContent}' | base64 -d > '${resolvedPath}'`;
      const writeResult = await executeSshOnExistingConnection(conn, `docker exec ${app.container_id} bash -c "${writeCommand}"`);
      if (writeResult.code !== 0) throw new Error(`Error writing file ${filePath}: ${writeResult.stderr}`);

      // 3. Verificar que el archivo se escribió correctamente
      const verifyCommand = `cat '${resolvedPath}' | wc -c`;
      const verifyResult = await executeSshOnExistingConnection(conn, `docker exec ${app.container_id} bash -c "${verifyCommand}"`);
      if (verifyResult.code !== 0) throw new Error(`Error verifying file ${filePath}: ${verifyResult.stderr}`);
      const fileSize = parseInt(verifyResult.stdout.trim(), 10);
      if (fileSize !== Buffer.byteLength(content, 'utf8')) {
        throw new Error(`Error de verificación: el tamaño del archivo ${filePath} no coincide. Esperado: ${Buffer.byteLength(content, 'utf8')}, Real: ${fileSize}`);
      }
      
      backups.push({ app_id: appId, user_id: userId, file_path: filePath, file_content: content });
      logEntries.push({ user_id: userId, server_id: server.id, event_type: 'file_written', description: `Archivo '${filePath}' escrito en el contenedor ${app.container_id.substring(0, 12)}.` });
    }

    // 4. Insertar logs y respaldos en paralelo
    await Promise.all([
      supabaseAdmin.from('app_file_backups').upsert(backups, { onConflict: 'app_id, file_path' }),
      supabaseAdmin.from('server_events_log').insert(logEntries)
    ]);

    return NextResponse.json({ message: 'Archivos guardados y respaldados correctamente.' });
  } catch (error: any) {
    console.error(`[API /apps/${appId}/files] Unhandled error in POST:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  } finally {
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