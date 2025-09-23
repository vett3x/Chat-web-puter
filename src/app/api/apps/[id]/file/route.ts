export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { executeSshCommand } from '@/lib/ssh-utils';
import { getAppAndServerWithStateCheck } from '@/lib/app-state-manager';

async function getUserId() {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { get: (name: string) => cookieStore.get(name)?.value } });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Acceso denegado.');
  return session.user.id;
}

// GET: Leer contenido de un archivo
export async function GET(req: NextRequest, context: { params: { id: string } }) {
  const appId = context.params.id;
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get('path');

  if (!filePath) return NextResponse.json({ message: 'La ruta del archivo es requerida.' }, { status: 400 });

  try {
    const userId = await getUserId();
    const { app, server } = await getAppAndServerWithStateCheck(appId, userId);
    const command = `cat /app/${filePath}`;
    const { stdout, stderr, code } = await executeSshCommand(server, `docker exec ${app.container_id} ${command}`);
    if (code !== 0) throw new Error(`Error al leer el archivo: ${stderr}`);
    
    return NextResponse.json({ content: stdout });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// POST: Escribir contenido en un archivo
export async function POST(req: NextRequest, context: { params: { id: string } }) {
  const appId = context.params.id;
  
  try {
    const userId = await getUserId();
    const { app, server } = await getAppAndServerWithStateCheck(appId, userId);
    const { filePath, content } = await req.json();

    if (!filePath || content === undefined) {
      return NextResponse.json({ message: 'La ruta y el contenido del archivo son requeridos.' }, { status: 400 });
    }

    const encodedContent = Buffer.from(content).toString('base64');
    const command = `bash -c "echo '${encodedContent}' | base64 -d > /app/${filePath}"`;
    
    const { stderr, code } = await executeSshCommand(server, `docker exec ${app.container_id} ${command}`);
    if (code !== 0) throw new Error(`Error al escribir en el archivo: ${stderr}`);

    return NextResponse.json({ message: 'Archivo guardado correctamente.' });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}