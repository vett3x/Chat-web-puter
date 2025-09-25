export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPERUSER_EMAILS } from '@/lib/constants';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

async function getIsSuperAdmin(): Promise<boolean> {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
      },
    }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  return profile?.role === 'super_admin';
}

// Simple semantic version comparison function
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;

    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

export async function GET(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  if (action === 'check') {
    try {
      // 1. Get local package.json version
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const localPackageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const localPackageJson = JSON.parse(localPackageJsonContent);
      const localPackageVersion = localPackageJson.version;

      // 2. Fetch remote package.json version from origin/main
      await execAsync('git fetch origin main');
      const { stdout: remotePackageJsonContent } = await execAsync('git show origin/main:package.json');
      const remotePackageJson = JSON.parse(remotePackageJsonContent);
      const remotePackageVersion = remotePackageJson.version;

      // 3. Compare versions
      const updateAvailable = compareVersions(localPackageVersion, remotePackageVersion) < 0;

      return NextResponse.json({
        updateAvailable,
        localPackageVersion,
        remotePackageVersion,
      });
    } catch (error: any) {
      console.error('[API app-update/check] Error:', error);
      return NextResponse.json({ message: `Error al comprobar actualizaciones: ${error.stderr || error.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ message: 'Acción no válida.' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  if (action === 'force') {
    try {
      let output = '';
      
      output += '--- Ejecutando git pull origin main ---\n';
      const { stdout: pullOut, stderr: pullErr } = await execAsync('git pull origin main');
      output += pullOut + (pullErr ? `\nSTDERR: ${pullErr}` : '') + '\n';

      output += '\n--- Ejecutando npm install ---\n';
      const { stdout: installOut, stderr: installErr } = await execAsync('npm install');
      output += installOut + (installErr ? `\nSTDERR: ${installErr}` : '') + '\n';

      output += '\n--- Ejecutando npm run build ---\n';
      const { stdout: buildOut, stderr: buildErr } = await execAsync('npm run build');
      output += buildOut + (buildErr ? `\nSTDERR: ${buildErr}` : '') + '\n';

      output += '\n--- Actualización completada. El servidor debería reiniciarse automáticamente. ---';

      // NOTE: We cannot restart the server from here as it would kill this API process.
      // The process manager (like PM2, Docker, etc.) should be configured to watch for changes in the .next directory and restart automatically.

      return NextResponse.json({ output });
    } catch (error: any) {
      console.error('[API app-update/force] Error:', error);
      return NextResponse.json({ message: `Error durante la actualización: ${error.stderr || error.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ message: 'Acción no válida.' }, { status: 400 });
}