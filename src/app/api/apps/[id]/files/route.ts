export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { executeSshCommand, writeRemoteFile } from '@/lib/ssh-utils';
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
    if (session.user.email && SUPERUSER_EMAILS.includes(session.user.email)) {
      userRole = 'super_admin';
    } else {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      userRole = profile ? profile.role as 'user' | 'admin' | 'super_admin' : 'user';
    }

    if (userRole === 'super_admin') {
      for (const key of Object.values(PERMISSION_KEYS)) {
        userPermissions[key] = true;
      }
    } else {
      const { data: profilePermissions } = await supabase.from('profiles').select('permissions').eq('id', session.user.id).single();
      userPermissions = profilePermissions ? profilePermissions.permissions || {} : {};
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
      const safeBasePath = '/app';
      const resolvedPath = path.posix.join(safeBasePath, filePath);
      if (!resolvedPath.startsWith(safeBasePath + path.posix.sep) && resolvedPath !== safeBasePath) {
        throw new Error(`Acceso denegado: La ruta '${filePath}' está fuera del directorio permitido.`);
      }
      const command = `cat '${resolvedPath}'`;
      const { stdout, stderr, code } = await executeSshCommand(server, `docker exec ${app.container_id} bash -c "${command}"`);
      if (code !== 0) throw new Error(`Error al leer el archivo: ${stderr || stdout}`);
      return NextResponse.json({ content: stdout });
    } else {
      const command = `find /app -path /app/node_modules -prune -o -path /app/.next -prune -o -path /app/dev.log -prune -o -path /app/cloudflared.log -prune -o -print`;
      const { stdout, stderr, code } = await executeSshCommand(server, `docker exec ${app.container_id} bash -c "${command}"`);
      if (code !== 0) throw new Error(`Error al listar archivos: ${stderr || stdout}`);
      const paths = stdout.trim().split('\n').map(p => p.replace('/app/', '')).filter(p => p && p !== '/app');
      const fileTree = buildFileTree(paths);
      return NextResponse.json(fileTree);
    }
  } catch (error: any) {
    console.error(`[API /apps/${appId}/files] Error en GET:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: any) {
  const appId = context.params.id;
  
  try {
    const { session, userPermissions } = await getSessionAndRole();
    if (!session || !userPermissions[PERMISSION_KEYS.CAN_MANAGE_DOCKER_CONTAINERS]) {
      return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
    }

    const userId = session.user.id;
    const { app, server } = await getAppAndServerForFileOps(appId, userId);
    const { files } = await req.json();

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ message: 'Se requiere una lista de archivos.' }, { status: 400 });
    }

    const backups = [];
    const logEntries = [];

    for (const file of files) {
      const { filePath, content } = file;
      if (!filePath || content === undefined) continue;

      const containerPath = path.posix.join('/app', filePath);
      const containerDir = path.posix.dirname(containerPath);
      const tempHostPath = `/tmp/dyad-upload-${Date.now()}-${Math.random().toString(36).substring(2, 15)}.tmp`;

      try {
        // 1. Escribir el contenido en un archivo temporal en el servidor remoto usando el nuevo writeRemoteFile
        await writeRemoteFile(server, tempHostPath, content);

        // 2. Crear el directorio de destino dentro del contenedor
        const { stderr: mkdirStderr, code: mkdirCode } = await executeSshCommand(server, `docker exec ${app.container_id} mkdir -p '${containerDir}'`);
        if (mkdirCode !== 0) {
          throw new Error(`Error al crear el directorio '${containerDir}' en el contenedor: ${mkdirStderr}`);
        }

        // 3. Copiar el archivo temporal del host remoto al contenedor
        const { stderr: cpStderr, code: cpCode } = await executeSshCommand(server, `docker cp '${tempHostPath}' '${app.container_id}:${containerPath}'`);
        if (cpCode !== 0) {
          throw new Error(`Error al copiar el archivo '${filePath}' al contenedor: ${cpStderr}`);
        }

        backups.push({ app_id: appId, user_id: userId, file_path: filePath, file_content: content });
        logEntries.push({ user_id: userId, server_id: server.id, event_type: 'file_written', description: `Archivo '${filePath}' escrito en el contenedor ${app.container_id.substring(0, 12)}.` });

      } catch (stepError: any) {
        const errorMessage = stepError.message || 'Error desconocido en el paso de archivo.';
        await supabaseAdmin.from('server_events_log').insert({
          user_id: userId,
          server_id: server.id,
          event_type: 'file_write_failed',
          description: `Fallo al escribir archivo '${filePath}' en contenedor ${app.container_id.substring(0, 12)}. Error: ${errorMessage}`,
        });
        throw new Error(`Fallo al procesar '${filePath}': ${errorMessage}`);
      } finally {
        // 4. Limpiar el archivo temporal del host remoto
        try {
          await executeSshCommand(server, `rm -f '${tempHostPath}'`);
        } catch (cleanupError: any) {
          console.warn(`[API /apps/${appId}/files] Advertencia: Fallo al limpiar el archivo temporal '${tempHostPath}' en el host: ${cleanupError.message}`);
        }
      }
    }

    await Promise.all([
      supabaseAdmin.from('app_file_backups').upsert(backups, { onConflict: 'app_id, file_path' }),
      supabaseAdmin.from('server_events_log').insert(logEntries)
    ]);

    return NextResponse.json({ message: 'Archivos guardados y respaldados correctamente.' });
  } catch (error: any) {
    console.error(`[API /apps/${appId}/files] Error en POST:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}