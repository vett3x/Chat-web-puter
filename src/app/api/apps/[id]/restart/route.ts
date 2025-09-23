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

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  const appId = context.params.id;

  try {
    const userId = await getUserId();
    const { app, server } = await getAppAndServerWithStateCheck(appId, userId);

    if (!app.container_id) {
      throw new Error('La aplicación no tiene un contenedor asociado para reiniciar.');
    }

    const { stderr, code } = await executeSshCommand(server, `docker restart ${app.container_id}`);

    if (code !== 0) {
      throw new Error(`Error al reiniciar el contenedor: ${stderr}`);
    }

    return NextResponse.json({ message: 'La aplicación se está reiniciando.' });
  } catch (error: any) {
    console.error(`[API RESTART /apps/${appId}] Error:`, error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}