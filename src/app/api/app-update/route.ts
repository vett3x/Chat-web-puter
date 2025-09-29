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

      // 2. Get local commit hash
      const { stdout: localCommitHash } = await execAsync('git rev-parse HEAD');

      // 3. Fetch remote and get remote package.json version and commit hash
      await execAsync('git fetch origin main');
      const { stdout: remotePackageJsonContent } = await execAsync('git show origin/main:package.json');
      const remotePackageJson = JSON.parse(remotePackageJsonContent);
      const remotePackageVersion = remotePackageJson.version;
      const { stdout: remoteCommitHash } = await execAsync('git rev-parse origin/main');

      // 4. Compare versions
      const updateAvailable = compareVersions(localPackageVersion, remotePackageVersion) < 0;

      let newCommits: string[] = [];
      if (updateAvailable) {
        const { stdout: gitLogOutput } = await execAsync(`git log --pretty=format:"%h %s" ${localCommitHash.trim()}..${remoteCommitHash.trim()}`);
        newCommits = gitLogOutput.split('\n')
                                 .filter(line => line.trim() !== '')
                                 .map(line => line.replace(/\[dyad\].*\s*-\s*wrote\s*\d+\s*file\(s\)/g, '').trim()) // Filter Dyad messages
                                 .filter(line => line !== ''); // Remove empty lines after filtering
      }

      return NextResponse.json({
        updateAvailable,
        localPackageVersion,
        remotePackageVersion,
        localCommitHash: localCommitHash.trim(),
        remoteCommitHash: remoteCommitHash.trim(),
        newCommits,
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
      const projectRoot = process.cwd();
      const updateScriptPath = path.join(projectRoot, 'update.sh'); // Changed to update.sh

      // Ensure the update.sh script exists
      try {
        await fs.access(updateScriptPath, fs.constants.F_OK);
      } catch (err) {
        throw new Error(`El script 'update.sh' no existe en ${updateScriptPath}.`);
      }

      // Add execute permissions to update.sh
      await execAsync(`chmod +x ${updateScriptPath}`);

      let output = '';
      output += `--- Ejecutando el script de actualización: ${updateScriptPath} ---\n`;

      // Execute update.sh with environment variables
      const { stdout, stderr } = await execAsync(`bash ${updateScriptPath}`, {
        cwd: projectRoot, // Ensure the script runs from the project root
        env: {
          ...process.env, // Pass all existing environment variables
          // Explicitly pass Supabase and other keys from process.env
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
          ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
          WEBSOCKET_PORT: process.env.WEBSOCKET_PORT,
        },
      });

      output += stdout;
      if (stderr) {
        output += `\nSTDERR: ${stderr}`;
      }
      output += '\n--- Script de actualización completado. ---';

      return NextResponse.json({ output });
    } catch (error: any) {
      console.error('[API app-update/force] Error:', error);
      return NextResponse.json({ message: `Error durante la actualización: ${error.stderr || error.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ message: 'Acción no válida.' }, { status: 400 });
}