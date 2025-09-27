export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { getAppAndServerWithStateCheck } from '@/lib/app-state-manager';
import { executeSshCommand } from '@/lib/ssh-utils';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import path from 'path'; // Import path module for path manipulation

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

// Helper to check if a path is within /app and not a critical system path
function isPathSafeForFileOperation(filePath: string): boolean {
  const normalizedPath = path.posix.normalize(filePath);
  // Must start with /app/ or be exactly /app
  if (!normalizedPath.startsWith('/app/') && normalizedPath !== '/app') {
    return false;
  }
  // Disallow paths that try to escape /app or target root/system directories
  // This is a basic check, more sophisticated path traversal prevention might be needed for production.
  if (normalizedPath.includes('..') || normalizedPath.startsWith('/etc') || normalizedPath.startsWith('/bin') || normalizedPath.startsWith('/usr') || normalizedPath.startsWith('/var') || normalizedPath === '/') {
    return false;
  }
  return true;
}

/**
 * Validates if a command is safe to execute based on a whitelist and specific rules.
 * @param command The command string to validate.
 * @param allowedCommands The list of whitelisted base commands.
 * @returns {boolean} True if the command is safe, false otherwise.
 */
function isCommandSafe(command: string, allowedCommands: string[]): boolean {
  const trimmedCommand = command.trim();
  const parts = trimmedCommand.split(/\s+/); // Split by one or more spaces
  const mainCommand = parts[0];

  if (!allowedCommands.includes(mainCommand)) {
    return false; // Not in the basic whitelist
  }

  // Specific, stricter rules for potentially dangerous commands
  switch (mainCommand) {
    case 'rm':
    case 'mv':
    case 'cp':
      // For file operations, ensure all paths involved are safe
      const fileOperationPaths = parts.slice(1).filter(p => p && !p.startsWith('-')); // Filter out options
      for (const p of fileOperationPaths) {
        if (!isPathSafeForFileOperation(p)) {
          console.warn(`[SECURITY] Blocked unsafe file operation path: "${p}" in command "${trimmedCommand}"`);
          return false;
        }
      }
      break;
    case 'docker':
      const dockerSubcommand = parts[1];
      switch (dockerSubcommand) {
        case 'run':
        case 'start':
        case 'stop':
        case 'restart':
        case 'ps':
        case 'logs':
        case 'inspect':
        case 'pull':
        case 'build':
        case 'rmi':
        case 'volume':
        case 'rm': // Added 'rm' here
          // These subcommands are generally allowed.
          // For 'docker rm', ensure it targets a specific container ID/name.
          if (dockerSubcommand === 'rm') {
            const rmContainerPattern = /^docker\s+rm\s+(-f)?\s+([a-zA-Z0-9_-]+)$/;
            if (!rmContainerPattern.test(trimmedCommand)) {
              console.warn(`[SECURITY] Blocked unsafe 'docker rm' command (must target specific container): "${trimmedCommand}"`);
              return false;
            }
          }
          break;
        case 'exec':
          // For 'docker exec', we need to parse the command *inside* the exec.
          // This is a recursive call to isCommandSafe.
          // The format is typically `docker exec <containerId> <command>`.
          // Or `docker exec <containerId> bash -c "<innerCommand>"`.
          const execCommandIndex = parts.indexOf('exec');
          if (execCommandIndex !== -1 && parts.length > execCommandIndex + 2) {
            const innerCommandParts = parts.slice(execCommandIndex + 2);
            let innerCommand = innerCommandParts.join(' ');

            // If it's `bash -c "..."`, extract the command inside quotes
            const bashCmatch = innerCommand.match(/^bash\s+-c\s+"(.*)"$/);
            if (bashCmatch && bashCmatch[1]) {
              innerCommand = bashCmatch[1];
            }
            
            // Recursively check the inner command
            if (!isCommandSafe(innerCommand, allowedCommands)) {
              console.warn(`[SECURITY] Blocked unsafe inner command in 'docker exec': "${innerCommand}"`);
              return false;
            }
          } else {
            console.warn(`[SECURITY] Blocked malformed 'docker exec' command: "${trimmedCommand}"`);
            return false;
          }
          break;
        default:
          console.warn(`[SECURITY] Blocked unknown docker subcommand: "${trimmedCommand}"`);
          return false; // Block unknown docker subcommands
      }
      break;
    case 'pkill':
      const safePkillPattern = /^pkill\s+(-f)?\s+(npm\s+run\s+dev|cloudflared)$/;
      if (!safePkillPattern.test(trimmedCommand)) {
        console.warn(`[SECURITY] Blocked unsafe 'pkill' command: "${trimmedCommand}"`);
        return false;
      }
      break;
    case 'apt-get':
    case 'curl':
    case 'sudo': 
      // These are generally safe for installation/download within a container.
      // We assume the AI won't try to download/install malicious software.
      break;
    // Other commands like npm, npx, git, ls, cd, pwd, cat, echo, mkdir, grep, find, touch, chmod, chown
    // are allowed by default if they are in `allowedCommands` and don't fall into the above dangerous categories.
    default:
      break;
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

    // --- Consultar el estado de seguridad global ---
    const { data: globalSettings, error: settingsError } = await supabaseAdmin
      .from('global_settings')
      .select('security_enabled')
      .single();

    if (settingsError) {
      console.error('[SECURITY] Could not fetch global security setting:', settingsError);
      throw new Error('Error interno de seguridad al verificar la configuración global.');
    }

    const securityEnabled = globalSettings?.security_enabled ?? true; // Default to true if not found

    if (!securityEnabled) {
      console.warn(`[SECURITY BYPASS] Command execution for app ${appId} bypassed security checks (global setting disabled): "${command}"`);
      await supabaseAdmin.from('server_events_log').insert({
        user_id: userId,
        server_id: app.server_id,
        event_type: 'command_security_bypassed',
        description: `Ejecución de comando bypassó la seguridad (desactivada globalmente) en el contenedor ${app.container_id.substring(0, 12)}.`,
        command_details: command,
      });
      // If security is disabled, skip the isCommandSafe check
    } else {
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
    }

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