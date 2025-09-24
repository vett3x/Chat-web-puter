export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { executeSshCommand } from '@/lib/ssh-utils';
import { getAppAndServerForFileOps } from '@/lib/app-state-manager';
import path from 'path';
import { Client as SshClient } from 'ssh2';
import { SUPERUSER_EMAILS, UserPermissions, PERMISSION_KEYS } from '@/lib/constants'; // Importación actualizada
import { randomBytes } from 'crypto'; // Importar para generar nombres de archivo temporales

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

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
    const { session, userRole } = await getSessionAndRole();
    if (!session || !userRole || !session.user.id) {
      return NextResponse.json({ message: 'Acceso denegado. No autenticado.' }, { status: 401 });
    }
    const userId = session.user.id; // Ensure userId is a string here

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

// POST: Escribir MÚLTIPLES archivos en una sola conexión usando `docker cp`
export async function POST(req: NextRequest, context: any) {
  const appId = context.params.id;
  
  const conn = new SshClient();
  let currentUserId: string | undefined; // Declarar userId con let
  let currentServer: any | undefined; // Declarar server con let

  try {
    const { session, userRole, userPermissions } = await getSessionAndRole();
    if (!session || !userRole) {
      return NextResponse.json({ message: 'Acceso denegado. No autenticado.' }, { status: 401 });
    }
    // Check for granular permission: can_manage_docker_containers
    if (!userPermissions[PERMISSION_KEYS.CAN_MANAGE_DOCKER_CONTAINERS]) {
      return NextResponse.json({ message: 'Acceso denegado. No tienes permiso para gestionar contenedores Docker.' }, { status: 403 });
    }

    currentUserId = session.user.id; // Asignar valor a currentUserId
    const { app, server } = await getAppAndServerForFileOps(appId, currentUserId!); // Use non-null assertion
    currentServer = server; // Asignar valor a currentServer

    const { files } = await req.json();

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ message: 'Se requiere una lista de archivos.' }, { status: 400 });
    }

    // --- Conexión SSH Única ---
    console.log(`[API /apps/${appId}/files] Establishing SSH connection to ${currentServer.ip_address}...`);
    await new Promise<void>((resolve, reject) => {
      conn.on('ready', () => {
        console.log(`[API /apps/${appId}/files] SSH connection ready.`);
        resolve();
      }).on('error', (err) => {
        console.error(`[API /apps/${appId}/files] SSH connection error:`, err);
        reject(err);
      }).connect({
        host: currentServer.ip_address,
        port: currentServer.ssh_port || 22,
        username: currentServer.ssh_username,
        password: currentServer.ssh_password,
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

      // Asegurarse de que filePath no comience con /app/ si ya se va a añadir
      const cleanedFilePath = filePath.startsWith('app/') ? filePath.substring(4) : filePath;
      const targetPathInContainer = path.join('/app', cleanedFilePath); // La ruta final dentro del contenedor
      
      if (!targetPathInContainer.startsWith('/app/')) { // Validación de seguridad adicional
        console.warn(`[API /apps/${appId}/files] Skipping unsafe file path: ${filePath} -> ${targetPathInContainer}`);
        continue;
      }
      const directoryInContainer = path.dirname(targetPathInContainer);

      console.log(`[API /apps/${appId}/files] Processing file: ${filePath}`);
      console.log(`[API /apps/${appId}/files] Target path inside container: ${targetPathInContainer}`);

      // Log: Iniciando procesamiento de archivo
      await supabaseAdmin.from('server_events_log').insert({
        user_id: currentUserId,
        server_id: currentServer.id,
        event_type: 'file_upload_step',
        description: `Iniciando subida de archivo: '${filePath}'`,
      });

      // 1. Crear directorios dentro del contenedor (docker cp no crea directorios padre por defecto)
      const mkdirCommand = `mkdir -p '${directoryInContainer}'`;
      console.log(`[API /apps/${appId}/files] Executing mkdir in container: ${mkdirCommand}`);
      const mkdirResult = await executeSshOnExistingConnection(conn, `docker exec ${app.container_id} bash -c "${mkdirCommand}"`);
      if (mkdirResult.code !== 0) {
        console.error(`[API /apps/${appId}/files] mkdir failed for ${filePath}: STDERR: ${mkdirResult.stderr}`);
        await supabaseAdmin.from('server_events_log').insert({
          user_id: currentUserId,
          server_id: currentServer.id,
          event_type: 'file_upload_failed',
          description: `Fallo al crear directorio para '${filePath}': ${mkdirResult.stderr}`,
        });
        throw new Error(`Error creating directory for ${filePath}: ${mkdirResult.stderr}`);
      }
      console.log(`[API /apps/${appId}/files] mkdir successful for ${filePath}.`);
      // Log: Directorio creado
      await supabaseAdmin.from('server_events_log').insert({
        user_id: currentUserId,
        server_id: currentServer.id,
        event_type: 'file_upload_step',
        description: `Directorio creado para '${filePath}'`,
      });

      // 2. Crear un archivo temporal en el host con el contenido
      const tempFileName = `temp_file_${randomBytes(16).toString('hex')}`;
      const tempFilePathOnHost = `/tmp/${tempFileName}`;
      const encodedContent = Buffer.from(content).toString('base64');
      const writeTempFileCommand = `echo '${encodedContent}' | base64 -d > '${tempFilePathOnHost}'`;
      console.log(`[API /apps/${appId}/files] Writing temporary file to host: ${tempFilePathOnHost}. Content length: ${content.length}`);
      const writeTempResult = await executeSshOnExistingConnection(conn, writeTempFileCommand);
      if (writeTempResult.code !== 0) {
        console.error(`[API /apps/${appId}/files] Writing temp file failed: STDERR: ${writeTempResult.stderr}`);
        await supabaseAdmin.from('server_events_log').insert({
          user_id: currentUserId,
          server_id: currentServer.id,
          event_type: 'file_upload_failed',
          description: `Fallo al escribir archivo temporal en host para '${filePath}': ${writeTempResult.stderr}`,
        });
        throw new Error(`Error writing temporary file to host: ${writeTempResult.stderr}`);
      }
      console.log(`[API /apps/${appId}/files] Temporary file written to host: ${tempFilePathOnHost}.`);
      // Log: Archivo temporal creado
      await supabaseAdmin.from('server_events_log').insert({
        user_id: currentUserId,
        server_id: currentServer.id,
        event_type: 'file_upload_step',
        description: `Archivo temporal creado en host para '${filePath}'`,
      });

      // 3. Copiar el archivo temporal del host al contenedor usando `docker cp`
      const dockerCpCommand = `docker cp '${tempFilePathOnHost}' ${app.container_id}:'${targetPathInContainer}'`;
      console.log(`[API /apps/${appId}/files] Executing docker cp: ${dockerCpCommand}`);
      const dockerCpResult = await executeSshOnExistingConnection(conn, dockerCpCommand);
      if (dockerCpResult.code !== 0) {
        console.error(`[API /apps/${appId}/files] docker cp failed for ${filePath}: STDERR: ${dockerCpResult.stderr}`);
        await supabaseAdmin.from('server_events_log').insert({
          user_id: currentUserId,
          server_id: currentServer.id,
          event_type: 'file_upload_failed',
          description: `Fallo al copiar archivo a contenedor con docker cp para '${filePath}': ${dockerCpResult.stderr}`,
        });
        throw new Error(`Error copying file with docker cp: ${dockerCpResult.stderr}`);
      }
      console.log(`[API /apps/${appId}/files] docker cp successful for ${filePath}.`);
      // Log: Archivo copiado al contenedor
      await supabaseAdmin.from('server_events_log').insert({
        user_id: currentUserId,
        server_id: currentServer.id,
        event_type: 'file_upload_step',
        description: `Archivo '${filePath}' copiado al contenedor`,
      });

      // 4. Eliminar el archivo temporal del host
      const deleteTempFileCommand = `rm -f '${tempFilePathOnHost}'`;
      console.log(`[API /apps/${appId}/files] Deleting temporary file from host: ${tempFilePathOnHost}`);
      const deleteTempResult = await executeSshOnExistingConnection(conn, deleteTempFileCommand);
      if (deleteTempResult.code !== 0) {
        console.warn(`[API /apps/${appId}/files] Failed to delete temporary file ${tempFilePathOnHost}: STDERR: ${deleteTempResult.stderr}`);
        // No lanzar error, es una limpieza post-operación
      }
      console.log(`[API /apps/${appId}/files] Temporary file deleted from host.`);
      // Log: Archivo temporal eliminado
      await supabaseAdmin.from('server_events_log').insert({
        user_id: currentUserId,
        server_id: currentServer.id,
        event_type: 'file_upload_step',
        description: `Archivo temporal eliminado del host para '${filePath}'`,
      });

      // 5. Verificar que el archivo se escribió correctamente dentro del contenedor
      const verifyCommand = `ls -l '${targetPathInContainer}' && cat '${targetPathInContainer}' | wc -c`;
      console.log(`[API /apps/${appId}/files] Verifying file in container: ${verifyCommand}`);
      const verifyResult = await executeSshOnExistingConnection(conn, `docker exec ${app.container_id} bash -c "${verifyCommand}"`);
      if (verifyResult.code !== 0) {
        console.error(`[API /apps/${appId}/files] Verification failed for ${filePath}: STDERR: ${verifyResult.stderr}`);
        await supabaseAdmin.from('server_events_log').insert({
          user_id: currentUserId,
          server_id: currentServer.id,
          event_type: 'file_upload_failed',
          description: `Fallo de verificación para '${filePath}': ${verifyResult.stderr}`,
        });
        throw new Error(`Error verifying file ${filePath} in container: ${verifyResult.stderr}`);
      }
      const [lsOutput, wcOutput] = verifyResult.stdout.split('\n');
      const fileSize = parseInt(wcOutput.trim(), 10);
      if (fileSize !== content.length) {
        console.error(`[API /apps/${appId}/files] File size mismatch for ${filePath}. Expected: ${content.length}, Actual: ${fileSize}`);
        await supabaseAdmin.from('server_events_log').insert({
          user_id: currentUserId,
          server_id: currentServer.id,
          event_type: 'file_upload_failed',
          description: `Fallo de verificación de tamaño para '${filePath}'. Esperado: ${content.length}, Real: ${fileSize}`,
        });
        throw new Error(`Error de verificación: el tamaño del archivo ${filePath} no coincide. Esperado: ${content.length}, Real: ${fileSize}`);
      }
      console.log(`[API /apps/${appId}/files] File ${filePath} verified. Size: ${fileSize} bytes.`);
      // Log: Archivo verificado
      await supabaseAdmin.from('server_events_log').insert({
        user_id: currentUserId,
        server_id: currentServer.id,
        event_type: 'file_upload_step',
        description: `Archivo '${filePath}' verificado en el contenedor`,
      });
      
      // 6. Preparar para respaldo en DB
      backups.push({
        app_id: appId,
        user_id: currentUserId,
        server_id: currentServer.id, // Add server_id to backup
        file_path: filePath,
        file_content: content,
      });

      // 7. Preparar entrada de log
      logEntries.push({
        user_id: currentUserId,
        server_id: currentServer.id,
        event_type: 'file_written',
        description: `Archivo '${filePath}' escrito en el contenedor ${app.container_id.substring(0, 12)}.`,
      });
    }

    // 8. Insertar logs y respaldos en paralelo
    console.log(`[API /apps/${appId}/files] Inserting ${backups.length} backups and ${logEntries.length} log entries into Supabase.`);
    await Promise.all([
      supabaseAdmin.from('app_file_backups').upsert(backups, { onConflict: 'app_id, file_path' }),
      supabaseAdmin.from('server_events_log').insert(logEntries)
    ]);
    console.log(`[API /apps/${appId}/files] Supabase updates complete.`);

    return NextResponse.json({ message: 'Archivos guardados y respaldados correctamente.' });
  } catch (error: any) {
    console.error(`[API /apps/${appId}/files] Unhandled error in POST:`, error);
    // Log general error
    await supabaseAdmin.from('server_events_log').insert({
      user_id: currentUserId, // Usar currentUserId
      server_id: currentServer?.id, // Usar currentServer?.id para manejar si no está definido
      event_type: 'file_upload_failed',
      description: `Error general al subir archivos: ${error.message}`,
    });
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