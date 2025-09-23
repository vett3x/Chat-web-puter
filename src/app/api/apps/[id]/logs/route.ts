export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { getAppAndServerWithStateCheck } from '@/lib/app-state-manager';
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
    const { app, server } = await getAppAndServerWithStateCheck(appId, userId);

    if (!app.container_id) {
      return NextResponse.json({ logs: 'La aplicación no tiene un contenedor asociado.' });
    }

    const { stdout, stderr, code } = await executeSshCommand(server, `docker logs --tail 100 ${app.container_id}`);
    
    // Es normal que los logs salgan por stderr, así que los combinamos.
    const logs = `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`;

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error(`[API LOGS /apps/${appId}] Error:`, error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}