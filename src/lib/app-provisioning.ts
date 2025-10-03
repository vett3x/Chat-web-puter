"use server";

import { createClient } from '@supabase/supabase-js';
import { createAndProvisionCloudflareTunnel } from '@/lib/tunnel-orchestration';
import { executeSshCommand } from './ssh-utils';
import { generateRandomPort } from '@/lib/utils';
import { DEFAULT_INSTALL_DEPS_SCRIPT } from '@/components/server-detail-tabs/docker/create-container-constants';
import { createAppDatabaseSchema } from './database-provisioning';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AppProvisioningData {
  appId: string;
  userId: string;
  appName: string;
  conversationId: string;
  mainPurpose: string;
  keyFeatures?: string;
}

async function updateAppStatus(appId: string, status: 'ready' | 'failed', details: object = {}) {
  const { error } = await supabaseAdmin
    .from('user_apps')
    .update({ status, ...details })
    .eq('id', appId);
  if (error) {
    console.error(`[Provisioning] Error updating app ${appId} status to ${status}:`, error);
  }
}

async function appendToServerProvisioningLog(serverId: string | null, logContent: string) {
  if (!serverId) {
    console.warn(`[App Provisioning] No serverId available for logging: ${logContent}`);
    return;
  }
  const { error } = await supabaseAdmin.rpc('append_to_provisioning_log', {
    server_id: serverId,
    log_content: logContent,
  });
  if (error) {
    console.error(`[App Provisioning] Error appending to server ${serverId} log:`, error);
  }
}

export async function provisionApp(data: AppProvisioningData) {
  const { appId, userId, appName, conversationId, mainPurpose, keyFeatures } = data;
  let containerId: string | undefined;
  let server: any;
  let containerName: string | undefined;
  let serverIdForLog: string | null = null;
  let appDbCredentials: any = null;

  try {
    await supabaseAdmin.from('server_events_log').insert({
      user_id: userId,
      event_type: 'app_provisioning_started',
      description: `Iniciando aprovisionamiento para la aplicación '${appName}' (ID: ${appId}).`,
    });
    await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Iniciando aprovisionamiento para la aplicación '${appName}' (ID: ${appId}).\n`);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('max_containers, cpu_limit, memory_limit_mb, role')
      .eq('id', userId)
      .single();
    if (profileError || !profile) throw new Error('No se pudo verificar la cuota del usuario.');

    const { count: appCount, error: countError } = await supabaseAdmin
      .from('user_apps')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (countError) throw new Error('No se pudo contar las aplicaciones existentes del usuario.');

    if (profile.role !== 'super_admin' && appCount !== null && appCount >= profile.max_containers) {
      throw new Error(`Has alcanzado tu límite de ${profile.max_containers} contenedores/aplicaciones.`);
    }

    const { data: serverData, error: serverError } = await supabaseAdmin
      .from('user_servers')
      .select('id, ip_address, ssh_port, ssh_username, ssh_password, name')
      .eq('status', 'ready')
      .limit(1)
      .single();
    if (serverError || !serverData) throw new Error('No hay servidores listos disponibles en el sistema.');
    server = serverData;
    serverIdForLog = server.id;

    let dbEnvVars = '';
    if (false) { // <--- AQUÍ ESTÁ LA PRUEBA QUE PEDISTE
      await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Creando esquema de base de datos dedicado para la aplicación...\n`);
      appDbCredentials = await createAppDatabaseSchema(appId);
      await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Esquema de base de datos '${appDbCredentials.db_name}' y usuario creados.\n`);
      dbEnvVars = `-e DB_HOST=${appDbCredentials.db_host} -e DB_PORT=${appDbCredentials.db_port} -e DB_NAME=${appDbCredentials.db_name} -e DB_USER=${appDbCredentials.db_user} -e DB_PASSWORD=${appDbCredentials.db_password}`;
    } else {
      await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] OMITIENDO la creación de la base de datos para la prueba.\n`);
    }

    const containerPort = 3000;
    const hostPort = generateRandomPort();
    containerName = `app-${appName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${appId.substring(0, 8)}`;
    
    const quotaFlags = profile.role !== 'super_admin' ? `--cpus="${profile.cpu_limit}" --memory="${profile.memory_limit_mb}m"` : '';

    const { data: settings, error: settingsError } = await supabaseAdmin.from('global_settings').select('docker_run_template').single();
    if (settingsError || !settings?.docker_run_template) throw new Error('No se pudo cargar la plantilla de aprovisionamiento.');
    
    let runCommand = settings.docker_run_template;
    runCommand = runCommand
      .replace('[nombre-generado]', containerName)
      .replace('[puerto-aleatorio]', String(hostPort))
      .replace('[quota_flags]', quotaFlags)
      .replace('[variables_de_entorno_bd]', dbEnvVars) // Esto será una cadena vacía
      .replace('[volumen-generado]', `${containerName}-app-data:/app`)
      .replace('[imagen_base]', 'node:lts-bookworm')
      .replace('[entrypoint_command]', 'tail -f /dev/null');

    await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Ejecutando comando Docker para crear contenedor: ${runCommand}\n`);
    const { stdout: newContainerId, stderr: runStderr, code: runCode } = await executeSshCommand(server, runCommand);
    if (runCode !== 0) throw new Error(`Error al crear el contenedor Docker: ${runStderr}`);
    containerId = newContainerId.trim();

    await supabaseAdmin.from('user_apps').update({ 
      server_id: server.id, 
      container_id: containerId,
      db_host: appDbCredentials?.db_host || null,
      db_port: appDbCredentials?.db_port || null,
      db_name: appDbCredentials?.db_name || null,
      db_user: appDbCredentials?.db_user || null,
      db_password: appDbCredentials?.db_password || null,
    }).eq('id', appId);

    const finalInstallScript = DEFAULT_INSTALL_DEPS_SCRIPT.replace(/__CONTAINER_PORT__/g, String(containerPort));
    const encodedScript = Buffer.from(finalInstallScript).toString('base64');
    const { stdout: installStdout, stderr: installStderr, code: installCode } = await executeSshCommand(server, `docker exec ${containerId} bash -c "echo '${encodedScript}' | base64 -d | bash"`);
    if (installCode !== 0) throw new Error(`Error al instalar dependencias en el contenedor: ${installStderr || installStdout}`);

    const { data: cfDomain, error: cfDomainError } = await supabaseAdmin.from('cloudflare_domains').select('id, domain_name, api_token, zone_id, account_id').limit(1).single();
    if (cfDomainError || !cfDomain) throw new Error('No hay dominios de Cloudflare configurados.');

    const { tunnelData } = await createAndProvisionCloudflareTunnel({ userId, serverId: server.id, containerId, cloudflareDomainId: cfDomain.id, containerPort, hostPort, subdomain: containerName, serverDetails: server, cloudflareDomainDetails: cfDomain });

    await updateAppStatus(appId, 'ready', { url: `https://${tunnelData.full_domain}`, tunnel_id: tunnelData.id });
    await supabaseAdmin.from('server_events_log').insert({
      user_id: userId,
      event_type: 'app_provisioning_succeeded',
      description: `Aplicación '${appName}' (ID: ${appId}) aprovisionada exitosamente. URL: ${tunnelData.full_domain}`,
      server_id: serverIdForLog,
      command_details: `Container ID: ${containerId}, Host Port: ${hostPort}, Tunnel ID: ${tunnelData.id}`,
    });

  } catch (error: any) {
    console.error(`[App Provisioning] Failed for app ${appId}:`, error);
    await updateAppStatus(appId, 'failed');
    
    await supabaseAdmin.from('server_events_log').insert({
      user_id: userId,
      event_type: 'app_provisioning_failed',
      description: `Fallo en el aprovisionamiento de la aplicación '${appName}' (ID: ${appId}). Error: ${error.message}`,
      server_id: serverIdForLog,
      command_details: `Container ID: ${containerId || 'N/A'}`,
    });

    if (containerId && server && containerName) {
      try {
        await executeSshCommand(server, `docker rm -f ${containerId}`);
        await executeSshCommand(server, `docker volume rm ${containerName}-app-data`);
      } catch (cleanupError) {
        console.error(`[App Provisioning] Failed to cleanup container ${containerId} for failed app ${appId}:`, cleanupError);
      }
    }
  }
}