import { createClient } from '@supabase/supabase-js';
import { executeSshCommand } from '@/lib/ssh-utils';
import { provisionApp } from '@/lib/app-provisioning'; // Re-utilizamos la lógica de aprovisionamiento

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function restoreAppFromHibernation(appId: string, userId: string, appName: string, conversationId: string) {
    // 1. Re-provision the app (creates container, installs deps, creates tunnel)
    // We can re-use the main provisioning logic. It will create a new container and tunnel.
    await provisionApp({ appId, userId, appName, conversationId });

    // 2. Get the new container and server details
    const { data: appDetails } = await supabaseAdmin.from('user_apps').select('container_id, user_servers(*)').eq('id', appId).single();
    if (!appDetails || !appDetails.container_id || !appDetails.user_servers) {
        throw new Error('Failed to get new container details after re-provisioning.');
    }
    const server = appDetails.user_servers as any;
    const containerId = appDetails.container_id;

    // 3. Restore files from backup
    const { data: backups } = await supabaseAdmin.from('app_file_backups').select('file_path, file_content').eq('app_id', appId);
    if (backups) {
        for (const backup of backups) {
            const encodedContent = Buffer.from(backup.file_content || '').toString('base64');
            const command = `bash -c "mkdir -p /app/$(dirname '${backup.file_path}') && echo '${encodedContent}' | base64 -d > /app/${backup.file_path}"`;
            await executeSshCommand(server, `docker exec ${containerId} ${command}`);
        }
    }

    // 4. Delete the backups now that they are restored
    await supabaseAdmin.from('app_file_backups').delete().eq('app_id', appId);
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
        await restoreAppFromHibernation(app.id, userId, app.name, app.conversation_id!);
        // Re-fetch app data as it has changed
        const { data: restoredApp } = await supabaseAdmin.from('user_apps').select('*, user_servers(*)').eq('id', appId).single();
        if (!restoredApp || !restoredApp.user_servers) throw new Error('No se pudo obtener la información del servidor después de la restauración.');
        return { app: restoredApp, server: restoredApp.user_servers as any };
    }

    if (app.status === 'suspended') {
        const server = app.user_servers as any;
        if (!server || !app.container_id) throw new Error('Faltan detalles del servidor o contenedor para la aplicación suspendida.');
        await executeSshCommand(server, `docker start ${app.container_id}`);
        await supabaseAdmin.from('user_apps').update({ status: 'ready' }).eq('id', app.id);
        return { app, server };
    }
    
    if (app.status !== 'ready') {
        throw new Error(`La aplicación está actualmente en estado '${app.status}' y no se puede acceder a ella.`);
    }

    if (!app.user_servers) throw new Error('La información del servidor para esta aplicación no está disponible.');

    return { app, server: app.user_servers as any };
}