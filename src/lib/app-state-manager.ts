import { createClient } from '@supabase/supabase-js';
import { executeSshCommand } from '@/lib/ssh-utils';
import { provisionApp } from '@/lib/app-provisioning'; // Re-utilizamos la lógica de aprovisionamiento

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function restoreAppFromArchive(appId: string, userId: string, appName: string, conversationId: string) {
    // 1. Re-provision the app (creates container, installs deps, creates tunnel)
    await provisionApp({ appId, userId, appName, conversationId });

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
        await restoreAppFromArchive(app.id, userId, app.name, app.conversation_id!);
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
        return { app, server };
    }
    
    if (app.status !== 'ready') {
        throw new Error(`La aplicación está actualmente en estado '${app.status}' y no se puede acceder a ella.`);
    }

    if (!app.user_servers) throw new Error('La información del servidor para esta aplicación no está disponible.');

    return { app, server: app.user_servers as any };
}