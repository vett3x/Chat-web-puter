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
      throw new Error('La aplicación no tiene un contenedor asociado para descargar.');
    }

    // 1. Create a gzipped tar archive of the /app directory inside the container and stream it to stdout
    const command = `docker exec ${app.container_id} tar -cz -C /app .`;
    const { stdout, stderr, code } = await executeSshCommand(server, command);

    if (code !== 0) {
      throw new Error(`Error al crear el archivo del proyecto: ${stderr}`);
    }

    // 2. Convert the binary stdout string to a Buffer
    const fileBuffer = Buffer.from(stdout, 'binary');

    // 3. Create the response with appropriate headers
    const headers = new Headers();
    headers.append('Content-Disposition', `attachment; filename="${app.name || 'project'}.tar.gz"`);
    headers.append('Content-Type', 'application/gzip');
    headers.append('Content-Length', fileBuffer.length.toString());

    // 4. Return a standard Response object, which is compatible with Next.js Route Handlers
    // This also resolves the TypeScript build error.
    return new Response(fileBuffer, { headers });

  } catch (error: any) {
    console.error(`[API /apps/${appId}/download] Error:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
  // No finally block needed as we are not creating temporary files anymore.
}