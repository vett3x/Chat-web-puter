export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { executeSshCommand, transferDirectoryScp } from '@/lib/ssh-utils';
import { getAppAndServerWithStateCheck } from '@/lib/app-state-manager';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import crypto from 'crypto';
import { SUPERUSER_EMAILS, UserPermissions, PERMISSION_KEYS } from '@/lib/constants';

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const MAX_VERSIONS_TO_KEEP = 20;

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

async function pruneOldVersions(appId: string, userId: string) {
  try {
    const { data: allBackups, error: fetchError } = await supabaseAdmin
      .from('app_file_backups')
      .select('created_at')
      .eq('app_id', appId)
      .eq('user_id', userId);

    if (fetchError) throw fetchError;

    const uniqueTimestamps = [...new Set(allBackups.map(b => b.created_at))];
    uniqueTimestamps.sort((a, b) => new Date(b).getTime() - new Date(a).getTime()); // Sort descending (newest first)

    if (uniqueTimestamps.length > MAX_VERSIONS_TO_KEEP) {
      const timestampsToDelete = uniqueTimestamps.slice(MAX_VERSIONS_TO_KEEP);
      console.log(`[Pruning] App ${appId}: Found ${uniqueTimestamps.length} versions. Deleting ${timestampsToDelete.length} oldest versions.`);
      
      const { error: deleteError } = await supabaseAdmin
        .from('app_file_backups')
        .delete()
        .in('created_at', timestampsToDelete)
        .eq('app_id', appId)
        .eq('user_id', userId);

      if (deleteError) {
        console.error(`[Pruning] Error deleting old versions for app ${appId}:`, deleteError);
      } else {
        console.log(`[Pruning] Successfully deleted old versions for app ${appId}.`);
      }
    }
  } catch (error) {
    console.error(`[Pruning] A critical error occurred while pruning versions for app ${appId}:`, error);
  }
}

export async function GET(req: NextRequest, context: any) {
  const appId = context.params.id;
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get('path');

  try {
    const userId = await getUserId();
    const { app, server } = await getAppAndServerWithStateCheck(appId, userId);
    
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
  const localTempDir = path.join(os.tmpdir(), `dyad-upload-${crypto.randomBytes(16).toString('hex')}`);
  const remoteTempDir = `/tmp/dyad-upload-${crypto.randomBytes(16).toString('hex')}`;
  let serverDetailsForCleanup: any = null;

  try {
    const { session, userPermissions } = await getSessionAndRole();
    if (!session || !userPermissions[PERMISSION_KEYS.CAN_MANAGE_DOCKER_CONTAINERS]) {
      return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
    }

    const userId = session.user.id;
    const { app, server } = await getAppAndServerWithStateCheck(appId, userId);
    serverDetailsForCleanup = server;
    const { files } = await req.json();

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ message: 'Se requiere una lista de archivos.' }, { status: 400 });
    }

    await fs.mkdir(localTempDir, { recursive: true });
    for (const file of files) {
      const localFilePath = path.join(localTempDir, file.path);
      
      // Check if the path is likely a directory (ends with / or has no extension)
      const isDirectory = file.path.endsWith('/') || !path.extname(file.path);

      if (isDirectory) {
        await fs.mkdir(localFilePath, { recursive: true });
      } else {
        await fs.mkdir(path.dirname(localFilePath), { recursive: true });
        await fs.writeFile(localFilePath, file.content);
      }
    }

    await executeSshCommand(server, `mkdir -p ${remoteTempDir}`);
    await transferDirectoryScp(server, localTempDir, remoteTempDir);

    const localDirName = path.basename(localTempDir);
    const remoteSourcePath = `${remoteTempDir}/${localDirName}/.`;
    const { stderr: cpStderr, code: cpCode } = await executeSshCommand(server, `docker cp '${remoteSourcePath}' '${app.container_id}:/app/'`);
    if (cpCode !== 0) {
      throw new Error(`Error al copiar archivos al contenedor: ${cpStderr}`);
    }

    const hasPackageJson = files.some((file: { path: string }) => file.path === 'package.json');
    if (hasPackageJson) {
      await supabaseAdmin.from('server_events_log').insert({
        user_id: userId,
        server_id: server.id,
        event_type: 'npm_install_started',
        description: `package.json modificado. Ejecutando 'npm install' en el contenedor ${app.container_id.substring(0, 12)}.`
      });

      const { stderr: installStderr, code: installCode } = await executeSshCommand(server, `docker exec ${app.container_id} bash -c "cd /app && npm install"`);
      
      if (installCode !== 0) {
        await supabaseAdmin.from('server_events_log').insert({
          user_id: userId,
          server_id: server.id,
          event_type: 'npm_install_failed',
          description: `Falló 'npm install' en el contenedor ${app.container_id.substring(0, 12)}. Error: ${installStderr}`
        });
        throw new Error(`Error al ejecutar 'npm install' en el contenedor: ${installStderr}`);
      }

      await supabaseAdmin.from('server_events_log').insert({
        user_id: userId,
        server_id: server.id,
        event_type: 'npm_install_succeeded',
        description: `'npm install' completado exitosamente en el contenedor ${app.container_id.substring(0, 12)}.`
      });
    }

    const backups = files.map(file => ({ app_id: appId, user_id: userId, file_path: file.path, file_content: file.content }));
    const logEntries = files.map(file => ({ user_id: userId, server_id: server.id, event_type: 'file_written', description: `Archivo '${file.path}' escrito en el contenedor ${app.container_id.substring(0, 12)}.` }));
    
    await Promise.all([
      supabaseAdmin.from('app_file_backups').upsert(backups, { onConflict: 'app_id, file_path' }),
      supabaseAdmin.from('server_events_log').insert(logEntries)
    ]);

    // Prune old versions after successful save
    await pruneOldVersions(appId, userId);

    return NextResponse.json({ message: 'Archivos guardados y respaldados correctamente.' });

  } catch (error: any) {
    console.error(`[API /apps/${appId}/files] Error en POST:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  } finally {
    try {
      await fs.rm(localTempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn(`[API /apps/${appId}/files] Advertencia: Fallo al limpiar el directorio temporal local '${localTempDir}':`, cleanupError);
    }
    try {
      if (serverDetailsForCleanup) {
        await executeSshCommand(serverDetailsForCleanup, `rm -rf ${remoteTempDir}`);
      }
    } catch (cleanupError) {
      console.warn(`[API /apps/${appId}/files] Advertencia: Fallo al limpiar el directorio temporal remoto '${remoteTempDir}':`, cleanupError);
    }
  }
}