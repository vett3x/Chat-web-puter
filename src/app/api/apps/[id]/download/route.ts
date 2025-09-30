export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { getAppAndServerWithStateCheck } from '@/lib/app-state-manager';
import { executeSshCommand } from '@/lib/ssh-utils';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import crypto from 'crypto';

async function getUserId() {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { get: (name: string) => cookieStore.get(name)?.value } });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Acceso denegado.');
  return session.user.id;
}

export async function GET(req: NextRequest, context: any) {
  const appId = context.params.id;
  const tempDir = path.join(os.tmpdir(), `dyad-download-${crypto.randomBytes(16).toString('hex')}`);
  const archivePath = path.join(tempDir, 'project.tar.gz');

  try {
    const userId = await getUserId();
    const { app, server } = await getAppAndServerWithStateCheck(appId, userId);

    if (!app.container_id) {
      throw new Error('La aplicación no tiene un contenedor asociado para descargar.');
    }

    // 1. Create a temporary directory on the host machine
    await fs.mkdir(tempDir, { recursive: true });

    // 2. Copy the /app directory from the container to the temporary host directory
    const { stderr: cpStderr, code: cpCode } = await executeSshCommand(server, `docker cp ${app.container_id}:/app/. ${tempDir}`);
    if (cpCode !== 0) {
      throw new Error(`Error al copiar los archivos del contenedor: ${cpStderr}`);
    }

    // 3. Create a compressed tarball of the directory
    const { stderr: tarStderr, code: tarCode } = await executeSshCommand(server, `tar -czf ${archivePath} -C ${tempDir} .`);
    if (tarCode !== 0) {
      throw new Error(`Error al comprimir los archivos del proyecto: ${tarStderr}`);
    }

    // 4. Read the archive file into a buffer
    const fileBuffer = await fs.readFile(archivePath);

    // 5. Create the response with appropriate headers
    const headers = new Headers();
    headers.append('Content-Disposition', `attachment; filename="${app.name || 'project'}.tar.gz"`);
    headers.append('Content-Type', 'application/gzip');

    return new NextResponse(fileBuffer, { headers });

  } catch (error: any) {
    console.error(`[API /apps/${appId}/download] Error:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  } finally {
    // 6. Clean up the temporary directory and archive
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn(`[API /apps/${appId}/download] Advertencia: Fallo al limpiar el directorio temporal '${tempDir}':`, cleanupError);
    }
  }
}