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

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function getUserId() {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { get: (name: string) => cookieStore.get(name)?.value } });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Acceso denegado.');
  return session.user.id;
}

/**
 * Validates if a command is safe to execute based on a whitelist and specific rules.
 * @param command The command string to validate.
 * @param allowedCommands The list of whitelisted base commands.
 * @returns {boolean} True if the command is safe, false otherwise.
 */
function isCommandSafe(command: string, allowedCommands: string[]): boolean {
  const trimmedCommand = command.trim();
  const mainCommand = trimmedCommand.split(' ')[0];

  if (!allowedCommands.includes(mainCommand)) {
    return false; // Not in the basic whitelist
  }

  // Specific, stricter rules for potentially dangerous commands
  switch (mainCommand) {
    case 'rm':
      // Only allow 'rm -rf' or 'rm -r' on specific, non-critical subdirectories within /app
      const safeRmPattern = /^rm\s+(-r|-f|-rf|-fr)\s+(node_modules|\.next|build|dist)(\/.*)?$/;
      if (!safeRmPattern.test(trimmedCommand.replace('/app/', ''))) {
        console.warn(`[SECURITY] Blocked unsafe 'rm' command: "${trimmedCommand}"`);
        return false;
      }
      break;
    // Add other specific command rules here if needed in the future
    // e.g., for 'mv', 'cp', etc.
  }

  return true; // Command is in the whitelist and passes specific rules
}

export async function POST(req: NextRequest, context: any) {
  const appId = context.params.id;

  try {
    const userId = await getUserId();
    const { app, server } = await getAppAndServerWithStateCheck(appId, userId);

    if (!app.container_id) {
      throw new Error('La aplicación no tiene un contenedor asociado para ejecutar comandos.');
    }

    const body = await req.json();
    const { command } = execSchema.parse(body);

    // --- CAPA 1 y 2: VALIDACIÓN DE SEGURIDAD ---
    const { data: allowedCommandsData, error: fetchCommandsError } = await supabaseAdmin
      .from('allowed_commands')
      .select('command');

    if (fetchCommandsError) {
      console.error('[SECURITY] Could not fetch allowed commands from DB:', fetchCommandsError);
      throw new Error('Error interno de seguridad al verificar el comando.');
    }

    const ALLOWED_COMMANDS = allowedCommandsData.map(c => c.command);
    
    if (!isCommandSafe(command, ALLOWED_COMMANDS)) {
      console.warn(`[SECURITY] Blocked command execution for app ${appId}: "${command}"`);
      await supabaseAdmin.from('server_events_log').insert({
        user_id: userId,
        server_id: app.server_id,
        event_type: 'command_blocked',
        description: `Intento de ejecución de comando bloqueado en el contenedor ${app.container_id.substring(0, 12)}.`,
        command_details: command,
      });
      return NextResponse.json({ message: `Comando no permitido por razones de seguridad: "${command}"` }, { status: 403 });
    }
    // --- FIN DE LA VALIDACIÓN DE SEGURIDAD ---

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