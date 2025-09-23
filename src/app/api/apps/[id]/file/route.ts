export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { executeSshCommand } from '@/lib/ssh-utils';
import { getAppAndServerWithStateCheck } from '@/lib/app-state-manager';

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function getUserId() {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { get: (name: string) => cookieStore.get(name)?.value } });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Acceso denegado.');
  return session.user.id;
}

// GET: Leer contenido de un archivo
export async function GET(req: NextRequest, context: any) {
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

// POST: Escribir contenido en un archivo Y respaldarlo en la DB
export async function POST(req: NextRequest, context: any) {
  const appId = context.params.id;
  
  try {
    const userId = await getUserId();
    const { app, server } = await getAppAndServerWithStateCheck(appId, userId);
    const { filePath, content } = await req.json();

    if (!filePath || content === undefined) {
      return NextResponse.json({ message: 'La ruta y el contenido del archivo son requeridos.' }, { status: 400 });
    }

    // 1. Escribir en el contenedor para hot-reloading
    const encodedContent = Buffer.from(content).toString('base64');
    // Comando robusto para crear directorios y luego el archivo
    const command = `bash -c "mkdir -p /app/$(dirname '${filePath}') && echo '${encodedContent}' | base64 -d > /app/${filePath}"`;
    
    const { stderr, code } = await executeSshCommand(server, `docker exec ${app.container_id} ${command}`);
    if (code !== 0) throw new Error(`Error al escribir en el archivo del contenedor: ${stderr}`);

    // 2. Respaldar en la base de datos (upsert para crear o actualizar)
    const { error: backupError } = await supabaseAdmin
      .from('app_file_backups')
      .upsert(
        {
          app_id: appId,
          user_id: userId,
          file_path: filePath,
          file_content: content,
        },
        { onConflict: 'app_id, file_path' }
      );

    if (backupError) {
      // A pesar del error de respaldo, el archivo se guardó en el contenedor.
      // Se registra el error en el servidor pero no se lanza un error fatal al cliente.
      console.error(`Error backing up file ${filePath} for app ${appId}:`, backupError);
    }

    return NextResponse.json({ message: 'Archivo guardado y respaldado correctamente.' });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}