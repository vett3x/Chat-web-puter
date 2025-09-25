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

  // 1. Health Check: See if the npm run dev process is running.
  const checkCommand = `docker exec ${app.container_id} pgrep -f "npm run dev"`;
  const { code: checkCode } = await executeSshCommand(server, checkCommand);

  // If checkCode is not 0, the process is not running. Time to start the "safe mode" recovery.
  if (checkCode !== 0) {
    console.log(`[Safe Mode] App ${app.id} services not running. Initiating recovery.`);
    await supabaseAdmin.from('server_events_log').insert({
      user_id: app.user_id,
      server_id: app.server_id,
      event_type: 'app_recovery_started',
      description: `Servicios del contenedor ${app.container_id.substring(0, 12)} no detectados. Iniciando recuperación automática.`
    });

    // 2. Re-install dependencies just in case.
    await executeSshCommand(server, `docker exec ${app.container_id} bash -c "cd /app && npm install"`);

    // 3. Restart all services.
    const { data: tunnel } = await supabaseAdmin
      .from('docker_tunnels')
      .select('tunnel_id, tunnel_secret, container_port')
      .eq('container_id', app.container_id)
      .single();

    const killAppCommand = "pkill -f 'npm run dev' || true";
    const killTunnelCommand = "pkill cloudflared || true";
    const restartAppCommand = `nohup npm run dev -- --hostname 0.0.0.0 -p ${tunnel?.container_port || 3000} > /app/dev.log 2>&1`;

    let backgroundCommandList = [restartAppCommand];

    if (tunnel && tunnel.tunnel_id && tunnel.tunnel_secret) {
      const restartTunnelCommand = `nohup cloudflared tunnel run --token ${tunnel.tunnel_secret} ${tunnel.tunnel_id} > /app/cloudflared.log 2>&1`;
      backgroundCommandList.push(restartTunnelCommand);
    }

    const backgroundCommandString = backgroundCommandList.map(cmd => `(${cmd}) &`).join(' ');
    const commandsToRunInShell = `${killAppCommand}; ${killTunnelCommand}; cd /app && ${backgroundCommandString}`;
    const fullCommand = `docker exec ${app.container_id} bash -c "${commandsToRunInShell}"`;

    const { stderr, code } = await executeSshCommand(server, fullCommand);

    if (code !== 0 && stderr && !stderr.toLowerCase().includes('no process found')) {
      console.error(`[Safe Mode] Error restarting services for container ${app.container_id}: ${stderr}`);
      await supabaseAdmin.from('server_events_log').insert({
        user_id: app.user_id,
        server_id: app.server_id,
        event_type: 'app_recovery_failed',
        description: `Falló la recuperación automática para el contenedor ${app.container_id.substring(0, 12)}. Error: ${stderr}`
      });
    } else {
      console.log(`[Safe Mode] Services recovered for container ${app.container_id}`);
      await supabaseAdmin.from('server_events_log').insert({
        user_id: app.user_id,
        server_id: app.server_id,
        event_type: 'app_recovery_succeeded',
        description: `Servicios recuperados exitosamente para el contenedor ${app.container_id.substring(0, 12)}.`
      });
    }
  }
}

export async function getAppAndServerWithStateCheck(appId: string, userId: string) {
    const { data: app, error: appError } = await supabaseAdmin
        .from('user_apps')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', appId)
        .select('*, user_servers(id, ip_address, ssh_port, ssh_username, ssh_password)')
        .single();

    if (appError || !app) throw new Error('Aplicación no encontrada o acceso denegado.');

    if (app.status === 'hibernated') {
        await restoreAppFromArchive(app.id, userId, app.name, app.conversation_id!, app.prompt || '');
        const { data: restoredApp, error: restoredAppError } = await supabaseAdmin.from('user_apps').select('*, user_servers(id, ip_address, ssh_port, ssh_username, ssh_password)').eq('id', appId).single();
        if (restoredAppError || !restoredApp || !restoredApp.user_servers) throw new Error('No se pudo obtener la información del servidor después de la restauración.');
        return { app: restoredApp, server: restoredApp.user_servers as any };
    }

    if (app.status === 'suspended') {
        const server = app.user_servers as any;
        if (!server || !app.container_id) throw new Error('Faltan detalles del servidor o contenedor para la aplicación suspendida.');
        await executeSshCommand(server, `docker start ${app.container_id}`);
        await supabaseAdmin.from('user_apps').update({ status: 'ready' }).eq('id', app.id);
        await ensureServicesAreRunning(server, app);
        return { app, server };
    }
    
    if (app.status === 'ready') {
        const server = app.user_servers as any;
        if (!server) throw new Error('La información del servidor para esta aplicación no está disponible.');
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
    await provisionApp({ appId, userId, appName, conversationId, prompt });

    const { data: appDetails, error: appDetailsError } = await supabaseAdmin.from('user_apps').select('container_id, user_servers(id, ip_address, ssh_port, ssh_username, ssh_password)').eq('id', appId).single();
    if (appDetailsError || !appDetails || !appDetails.container_id || !appDetails.user_servers) {
        throw new Error('No se pudieron obtener los detalles del nuevo contenedor después del reaprovisionamiento.');
    }
    const server = appDetails.user_servers as any;
    const containerId = appDetails.container_id;

    const { data: backups, error: backupError } = await supabaseAdmin.from('app_file_backups').select('file_path, file_content').eq('app_id', appId);
    if (backupError) {
        throw new Error(`Error al recuperar las copias de seguridad de los archivos: ${backupError.message}`);
    }

    if (backups) {
        for (const backup of backups) {
            const encodedContent = Buffer.from(backup.file_content || '').toString('base64');
            const command = `mkdir -p /app/$(dirname '${backup.file_path}') && echo '${encodedContent}' | base64 -d > /app/${backup.file_path}`;
            await executeSshCommand(server, `docker exec ${containerId} bash -c "${command}"`);
        }
    }
}