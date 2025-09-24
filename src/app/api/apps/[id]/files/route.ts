export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { executeSshCommand } from '@/lib/ssh-utils';
import { getAppAndServerForFileOps } from '@/lib/app-state-manager';
import path from 'path';
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

// POST: Escribir MÚLTIPLES archivos usando echo y redirección
export async function POST(req: NextRequest, context: any) {
  const appId = context.params.id;
  
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

    console.log(`[API /apps/${appId}/files] Processing ${files.length} files for container ${app.container_id}`);

    const backups = [];
    const logEntries = [];

    for (const file of files) {
      const { path: filePath, content } = file;
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

      console.log(`[API /apps/${appId}/files] Writing file: ${filePath}`);

      // 1. Crear directorios si es necesario
      const directoryPath = path.dirname(resolvedPath);
      const mkdirCommand = `docker exec ${app.container_id} mkdir -p '${directoryPath}'`;
      console.log(`[API /apps/${appId}/files] Creating directory: ${directoryPath}`);
      const mkdirResult = await executeSshCommand(server, mkdirCommand);
      if (mkdirResult.code !== 0) {
        console.error(`[API /apps/${appId}/files] mkdir failed: ${mkdirResult.stderr}`);
        throw new Error(`Error creating directory: ${mkdirResult.stderr}`);
      }

      // 2. Escribir el archivo usando printf (más confiable que echo para contenido con caracteres especiales)
      // Escapamos el contenido para que sea seguro en bash
      const escapedContent = content
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "'\"'\"'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');

      const writeCommand = `docker exec ${app.container_id} bash -c "printf '%s' '${escapedContent}' > '${resolvedPath}'"`;
      
      console.log(`[API /apps/${appId}/files] Writing file with printf to: ${resolvedPath}`);
      const writeResult = await executeSshCommand(server, writeCommand);
      
      if (writeResult.code !== 0) {
        console.error(`[API /apps/${appId}/files] Write failed: ${writeResult.stderr}`);
        
        // Si printf falla, intentamos con un método alternativo usando base64
        console.log(`[API /apps/${appId}/files] Trying base64 method...`);
        const base64Content = Buffer.from(content).toString('base64');
        const base64Command = `docker exec ${app.container_id} bash -c "echo '${base64Content}' | base64 -d > '${resolvedPath}'"`;
        
        const base64Result = await executeSshCommand(server, base64Command);
        if (base64Result.code !== 0) {
          console.error(`[API /apps/${appId}/files] Base64 write also failed: ${base64Result.stderr}`);
          throw new Error(`Error writing file: ${base64Result.stderr}`);
        }
      }

      // 3. Verificar que el archivo se escribió correctamente
      const verifyCommand = `docker exec ${app.container_id} bash -c "if [ -f '${resolvedPath}' ]; then wc -c < '${resolvedPath}'; else echo 'FILE_NOT_FOUND'; fi"`;
      console.log(`[API /apps/${appId}/files] Verifying file: ${resolvedPath}`);
      const verifyResult = await executeSshCommand(server, verifyCommand);
      
      if (verifyResult.code !== 0 || verifyResult.stdout.trim() === 'FILE_NOT_FOUND') {
        console.error(`[API /apps/${appId}/files] File verification failed`);
        throw new Error(`File was not created: ${resolvedPath}`);
      }
      
      const fileSize = parseInt(verifyResult.stdout.trim(), 10);
      console.log(`[API /apps/${appId}/files] File verified. Size: ${fileSize} bytes (expected: ${content.length} bytes)`);

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

    return NextResponse.json({ message: 'Archivos guardados y respaldados correctamente.' });
  } catch (error: any) {
    console.error(`[API /apps/${appId}/files] Unhandled error in POST:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}