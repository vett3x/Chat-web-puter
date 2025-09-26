export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { getAppAndServerWithStateCheck } from '@/lib/app-state-manager';
import { executeSshCommand } from '@/lib/ssh-utils';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const execSchema = z.object({
  command: z.string().min(1, { message: 'El comando es requerido.' }),
});

// --- CAPA DE SEGURIDAD: LISTA BLANCA DE COMANDOS ---
// Solo se permitirán los comandos que comiencen con estas cadenas.
const ALLOWED_COMMANDS = ['npm', 'npx', 'yarn', 'pnpm'];

async function getUserId() {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { get: (name: string) => cookieStore.get(name)?.value } });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Acceso denegado.');
  return session.user.id;
}

export async function POST(req: NextRequest, context: any) {
  const appId = context.params.id;
  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const userId = await getUserId();
    const { app, server } = await getAppAndServerWithStateCheck(appId, userId);

    if (!app.container_id) {
      throw new Error('La aplicación no tiene un contenedor asociado para ejecutar comandos.');
    }

    const body = await req.json();
    const { command } = execSchema.parse(body);

    // --- VALIDACIÓN DE SEGURIDAD ---
    const mainCommand = command.trim().split(' ')[0];
    if (!ALLOWED_COMMANDS.includes(mainCommand)) {
      console.warn(`[SECURITY] Blocked command execution for app ${appId}: "${command}"`);
      // Log the suspicious command attempt
      await supabaseAdmin.from('server_events_log').insert({
        user_id: userId,
        server_id: app.server_id,
        event_type: 'command_blocked',
        description: `Intento de ejecución de comando bloqueado en el contenedor ${app.container_id.substring(0, 12)}.`,
        command_details: command,
      });
      return NextResponse.json({ message: `Comando no permitido por razones de seguridad: "${mainCommand}"` }, { status: 403 });
    }
    // --- FIN DE LA VALIDACIÓN DE SEGURIDAD ---

    // Log the command before execution
    await supabaseAdmin.from('server_events_log').insert({
      user_id: userId,
      server_id: app.server_id,
      event_type: 'command_executed',
      description: `Comando ejecutado en el contenedor ${app.container_id.substring(0, 12)}.`,
      command_details: command,
    });

    const fullCommand = `docker exec ${app.container_id} bash -c "cd /app && ${command.replace(/"/g, '\\"')}"`;
    const { stdout, stderr, code } = await executeSshCommand(server, fullCommand);

    if (code !== 0) {
      return NextResponse.json({ 
        message: `El comando falló con el código de salida ${code}.`, 
        output: stdout, 
        error: stderr 
      }, { status: 400 });
    }

    return NextResponse.json({ output: stdout });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error(`[API EXEC /apps/${appId}] Error:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}