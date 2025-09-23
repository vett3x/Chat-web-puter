export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { getAppAndServerForFileOps } from '@/lib/app-state-manager'; // Changed import
import { executeSshCommand } from '@/lib/ssh-utils';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function getUserId() {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { get: (name: string) => cookieStore.get(name)?.value } });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Acceso denegado.');
  return session.user.id;
}

export async function GET(req: NextRequest, context: any) {
  const appId = context.params.id;

  try {
    const userId = await getUserId();
    const { app, server } = await getAppAndServerForFileOps(appId, userId); // Use new function

    if (!app.container_id) {
      return NextResponse.json({ logs: 'La aplicación no tiene un contenedor asociado.' });
    }

    // Changed command to read the Next.js dev server log file
    const { stdout, stderr, code } = await executeSshCommand(server, `docker exec ${app.container_id} bash -c "tail -n 100 /app/dev.log"`);
    
    // Combine stdout and stderr, as tail might output to either.
    // If the file doesn't exist yet, stderr will contain an error message which is useful feedback.
    const logs = stdout || stderr;

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error(`[API LOGS /apps/${appId}] Error:`, error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}