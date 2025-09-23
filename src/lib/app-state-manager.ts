import { createClient } from '@supabase/supabase-js';
import { executeSshCommand } from '@/lib/ssh-utils';
import { provisionApp } from '@/lib/app-provisioning';

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * Se asegura de que los servicios clave (Next.js dev server, cloudflared) estén corriendo dentro del contenedor.
 * Si no lo están, los reinicia.
 */
async function ensureServicesAreRunning(server: any, app: any) {
  if (!app.container_id) return;

  // Obtener detalles del túnel si existe para esta app
  const { data: tunnel } = await supabaseAdmin
    .from('docker_tunnels')
    .select('tunnel_id, tunnel_secret, container_port')
    .eq('container_id', app.container_id)
    .single();

  // Comandos para reiniciar los servicios DENTRO del contenedor
  const killCommands = "pkill -f 'npm run dev' || true; pkill cloudflared || true";
  const restartAppCommand = `cd /app && nohup npm run dev -- -p ${tunnel?.container_port || 3000} > /app/dev.log 2>&1 &`;
  
  let fullCommand = `docker exec ${app.container_id} sh -c "${killCommands} && ${restartAppCommand}"`;

  // Si hay un túnel, también lo reiniciamos
  if (tunnel && tunnel.tunnel_id && tunnel.tunnel_secret) {
    const restartTunnelCommand = `nohup cloudflared tunnel run --token ${tunnel.tunnel_secret} ${tunnel.tunnel_id} > /app/cloudflared.log 2>&1 &`;
    fullCommand = `docker exec ${app.container_id} sh -c "${killCommands} && ${restartAppCommand} && ${restartTunnelCommand}"`;
  }

  const { stderr, code } = await executeSshCommand(server, fullCommand);

  if (code !== 0 && stderr && !stderr.toLowerCase().includes('no process found')) {
    console.error(`[ensureServicesAreRunning] Error restarting services for container ${app.container_id}: ${stderr}`);
    // No lanzamos un error fatal, pero lo registramos. La app podría seguir funcionando parcialmente.
  } else {
    console.log(`[ensureServicesAreRunning] Services checked/restarted for container ${app.container_id}`);
  }
}

/**
 * Fetches app and server details specifically for file operations,
 * without triggering state changes or service restarts.
 */
export async function getAppAndServerForFileOps(appId: string, userId: string) {
    const { data: app, error: appError } = await supabaseAdmin
        .from('user_apps')
        .select('*, user_servers(*)')
        .eq('id', appId)
        .eq('user_id', userId)
        .single();

    if (appError || !app) {
        throw new Error('Aplicación no encontrada o acceso denegado.');
    }
    if (!app.user_servers) {
        throw new Error('La información del servidor para esta aplicación no está disponible.');
    }
    // Allow file operations on ready, suspended, or even provisioning apps
    if (app.status === 'hibernated' || app.status === 'failed') {
        throw new Error(`La aplicación está en estado '${app.status}' y no se pueden modificar sus archivos.`);
    }

    return { app, server: app.user_servers as any };
}

export async function getAppAndServerWithStateCheck(appId: string, userId: string) {
    // 1. Get current app state and update activity timestamp
    const { data: app, error: appError } = await supabaseAdmin
        .from('user_apps')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', appId)
        .select('*, user_servers(*)')
        .single();

    if (appError || !app) throw new Error('Aplicación no encontrada o acceso denegado.');

    // 2. Handle different states
    if (app.status === 'hibernated') {
        await restoreAppFromArchive(app.id, userId, app.name, app.conversation_id!, app.prompt || '');
        // Re-fetch app data as it has changed
        const { data: restoredApp, error: restoredAppError } = await supabaseAdmin.from('user_apps').select('*, user_servers(*)').eq('id', appId).single();
        if (restoredAppError || !restoredApp || !restoredApp.user_servers) throw new Error('No se pudo obtener la información del servidor después de la restauración.');
        return { app: restoredApp, server: restoredApp.user_servers as any };
    }

    if (app.status === 'suspended') {
        const server = app.user_servers as any;
        if (!server || !app.container_id) throw new Error('Faltan detalles del servidor o contenedor para la aplicación suspendida.');
        await executeSshCommand(server, `docker start ${app.container_id}`);
        await supabaseAdmin.from('user_apps').update({ status: 'ready' }).eq('id', app.id);
        // NEW: Ensure services are running after waking up
        await ensureServicesAreRunning(server, app);
        return { app, server };
    }
    
    if (app.status === 'ready') {
        const server = app.user_servers as any;
        if (!server) throw new Error('La información del servidor para esta aplicación no está disponible.');
        // NEW: Ensure services are running even if state is 'ready'
        await ensureServicesAreRunning(server, app);
        return { app, server };
    }

    if (app.status !== 'ready') {
        throw new Error(`La aplicación está actualmente en estado '${app.status}' y no se puede acceder a ella.`);
    }

    if (!app.user_servers) throw new Error('La información del servidor para esta aplicación no está disponible.');

    return { app, server: app.user_servers as any };
}

async function restoreAppFromArchive(appId: string, userId: string, appName: string, conversationId: string, prompt: string) {
    // 1. Re-provision the app (creates container, installs deps, creates tunnel)
    await provisionApp({ appId, userId, appName, conversationId, prompt });

    // 2. Get the new container and server details
    const { data: appDetails, error: appDetailsError } = await supabaseAdmin.from('user_apps').select('container_id, user_servers(*)').eq('id', appId).single();
    if (appDetailsError || !appDetails || !appDetails.container_id || !appDetails.user_servers) {
        throw new Error('No se pudieron obtener los detalles del nuevo contenedor después del reaprovisionamiento.');
    }
    const server = appDetails.user_servers as any;
    const containerId = appDetails.container_id;

    // 3. Restore files from backup
    const { data: backups, error: backupError } = await supabaseAdmin.from('app_file_backups').select('file_path, file_content').eq('app_id', appId);
    if (backupError) {
        throw new Error(`Error al recuperar las copias de seguridad de los archivos: ${backupError.message}`);
    }

    if (backups) {
        for (const backup of backups) {
            const encodedContent = Buffer.from(backup.file_content || '').toString('base64');
            // Comando robusto para crear directorios y luego el archivo
            const command = `bash -c "mkdir -p /app/$(dirname '${backup.file_path}') && echo '${encodedContent}' | base64 -d > /app/${backup.file_path}"`;
            await executeSshCommand(server, `docker exec ${containerId} ${command}`);
        }
    }
    // NO eliminamos las copias de seguridad. Son la fuente de la verdad.
}