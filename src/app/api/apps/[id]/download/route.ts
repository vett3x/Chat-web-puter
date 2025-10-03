export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import * as tar from 'tar';
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
  const archivePath = `${tempDir}.tar.gz`;

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const userId = await getUserId();

    // 1. Get app name for the final filename
    const { data: app, error: appError } = await supabaseAdmin
      .from('user_apps')
      .select('name')
      .eq('id', appId)
      .eq('user_id', userId)
      .single();

    if (appError || !app) {
      throw new Error('Aplicación no encontrada o acceso denegado.');
    }

    // 2. Find the most recent version of the app
    const { data: latestVersion, error: versionError } = await supabaseAdmin
      .from('app_versions')
      .select('id')
      .eq('app_id', appId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (versionError || !latestVersion) {
      throw new Error('No se encontraron versiones para esta aplicación.');
    }

    // 3. Fetch all file backups for that latest version
    const { data: files, error: filesError } = await supabaseAdmin
      .from('app_file_backups')
      .select('file_path, file_content')
      .eq('version_id', latestVersion.id);

    if (filesError) {
      throw new Error(`Error al obtener los archivos del proyecto: ${filesError.message}`);
    }
    if (!files || files.length === 0) {
      throw new Error('Esta versión de la aplicación no tiene archivos para descargar.');
    }

    // 4. Recreate the project structure in a temporary local directory
    await fs.mkdir(tempDir, { recursive: true });
    for (const file of files) {
      const localFilePath = path.join(tempDir, file.file_path);
      // Ensure the directory for the file exists
      await fs.mkdir(path.dirname(localFilePath), { recursive: true });
      // Write the file content
      await fs.writeFile(localFilePath, file.file_content || '');
    }

    // 5. Create a gzipped tar archive from the temporary directory
    await tar.c(
      {
        gzip: true,
        file: archivePath,
        cwd: tempDir, // Change working directory to the temp dir
      },
      ['.'] // Archive everything in the current directory (which is tempDir)
    );

    // 6. Read the created archive into a buffer
    const fileBuffer = await fs.readFile(archivePath);

    // 7. Create and return the response
    const headers = new Headers();
    headers.append('Content-Disposition', `attachment; filename="${app.name || 'project'}.tar.gz"`);
    headers.append('Content-Type', 'application/gzip');
    headers.append('Content-Length', fileBuffer.length.toString());

    return new Response(fileBuffer as any, { headers });

  } catch (error: any) {
    console.error(`[API /apps/${appId}/download] Error:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  } finally {
    // 8. Clean up the temporary directory and archive file
    await fs.rm(tempDir, { recursive: true, force: true }).catch(e => console.warn(`Cleanup failed for dir ${tempDir}: ${e.message}`));
    await fs.unlink(archivePath).catch(e => console.warn(`Cleanup failed for file ${archivePath}: ${e.message}`));
  }
}