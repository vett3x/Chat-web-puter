export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPERUSER_EMAILS } from '@/lib/constants';
import { exec } from 'child_process';
import { promisify } from 'util';

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

export async function GET(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  if (action === 'check') {
    try {
      await execAsync('git fetch origin main');
      const { stdout: localCommit } = await execAsync('git rev-parse HEAD');
      const { stdout: remoteCommit } = await execAsync('git rev-parse origin/main');
      const { stdout: newCommitsLog } = await execAsync('git log HEAD..origin/main --oneline');

      const updateAvailable = localCommit.trim() !== remoteCommit.trim();
      const newCommits = newCommitsLog.trim().split('\n').filter(Boolean);

      return NextResponse.json({
        updateAvailable,
        localCommit: localCommit.trim().substring(0, 7),
        remoteCommit: remoteCommit.trim().substring(0, 7),
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