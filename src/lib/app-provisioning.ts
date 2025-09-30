"use server";

import { createClient } from '@supabase/supabase-js';
import { createAndProvisionCloudflareTunnel } from '@/lib/tunnel-orchestration';
import { executeSshCommand } from './ssh-utils';
import { generateRandomPort } from '@/lib/utils';
import { DEFAULT_INSTALL_DEPS_SCRIPT } from '@/components/server-detail-tabs/docker/create-container-constants';
import { createAppDatabaseSchema } from './database-provisioning'; // NEW: Import database provisioning utility

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AppProvisioningData {
  appId: string;
  userId: string;
  appName: string;
  conversationId: string;
  mainPurpose: string; // NEW
  keyFeatures?: string; // NEW
  // preferredTechnologies?: string; // REMOVED
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

// Helper to append to the server's provisioning log
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
  const { appId, userId, appName, conversationId, mainPurpose, keyFeatures } = data; // Removed preferredTechnologies
  let containerId: string | undefined;
  let server: any;
  let containerName: string | undefined;
  let serverIdForLog: string | null = null; // Initialize to null
  let appDbCredentials: any = null; // NEW: To store app-specific DB credentials

  try {
    // FASE 1: Configuración del Entorno y Verificación de Cuotas
    await supabaseAdmin.from('server_events_log').insert({
      user_id: userId,
      event_type: 'app_provisioning_started',
      description: `Iniciando aprovisionamiento para la aplicación '${appName}' (ID: ${appId}).`,
    });
    await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Iniciando aprovisionamiento para la aplicación '${appName}' (ID: ${appId}).\n`);


    // --- QUOTA ENFORCEMENT ---
    await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Verificando cuotas de usuario...\n`);
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('max_containers, cpu_limit, memory_limit_mb, role')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('No se pudo verificar la cuota del usuario.');
    }

    const { count: appCount, error: countError } = await supabaseAdmin
      .from('user_apps')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      throw new Error('No se pudo contar las aplicaciones existentes del usuario.');
    }

    if (profile.role !== 'super_admin' && appCount !== null && appCount >= profile.max_containers) {
      throw new Error(`Has alcanzado tu límite de ${profile.max_containers} contenedores/aplicaciones.`);
    }
    await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Cuotas de usuario verificadas. Límite de contenedores: ${profile.max_containers}.\n`);
    // --- END QUOTA ENFORCEMENT ---

    await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Buscando servidor listo disponible para el usuario ${userId}...\n`);
    const { data: serverData, error: serverError } = await supabaseAdmin
      .from('user_servers')
      .select('id, ip_address, ssh_port, ssh_username, ssh_password, name')
      .eq('user_id', userId)
      .eq('status', 'ready')
      .limit(1)
      .single();
      
    if (serverError || !serverData) {
      throw new Error('No hay servidores listos disponibles para tu usuario. Asegúrate de haber añadido y aprovisionado un servidor.');
    }
    server = serverData;
    serverIdForLog = server.id; // Assign value here
    await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Servidor '${server.name || server.ip_address}' (ID: ${server.id}) seleccionado.\n`);

    // NEW: Create app-specific database schema
    await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Creando esquema de base de datos dedicado para la aplicación...\n`);
    appDbCredentials = await createAppDatabaseSchema(appId);
    await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Esquema de base de datos '${appDbCredentials.db_name}' y usuario creados. Credenciales: Host=${appDbCredentials.db_host}, Port=${appDbCredentials.db_port}, User=${appDbCredentials.db_user}.\n`);

    const containerPort = 3000;
    const hostPort = generateRandomPort();
    containerName = `app-${appName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${appId.substring(0, 8)}`;
    
    // --- APLICACIÓN DE CUOTAS ---
    const quotaFlags = profile.role !== 'super_admin' ? `--cpus="${profile.cpu_limit}" --memory="${profile.memory_limit_mb}m"` : '';

    // NEW: Add database credentials as environment variables to the Docker run command
    const dbEnvVars = `
      -e DB_HOST=${appDbCredentials.db_host}
      -e DB_PORT=${appDbCredentials.db_port}
      -e DB_NAME=${appDbCredentials.db_name}
      -e DB_USER=${appDbCredentials.db_user}
      -e DB_PASSWORD=${appDbCredentials.db_password}
    `.replace(/\n/g, ' ').trim(); // Format for single line

    const runCommand = `docker run -d --name ${containerName} -p ${hostPort}:${containerPort} ${quotaFlags} ${dbEnvVars} -v ${containerName}-app-data:/app --entrypoint tail node:lts-bookworm -f /dev/null`;
    
    await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Ejecutando comando Docker para crear contenedor: ${runCommand}\n`);
    const { stdout: newContainerId, stderr: runStderr, code: runCode } = await executeSshCommand(server, runCommand);
    if (runCode !== 0) {
      await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] ERROR al crear el contenedor Docker. STDERR: ${runStderr}\n`);
      throw new Error(`Error al crear el contenedor Docker: ${runStderr}`);
    }
    containerId = newContainerId.trim();
    await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Contenedor Docker creado. ID: ${containerId}\n`);

    // NEW: Update user_apps with database credentials
    await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Actualizando registro de aplicación con ID de contenedor y credenciales de BD...\n`);
    await supabaseAdmin.from('user_apps').update({ 
      server_id: server.id, 
      container_id: containerId,
      db_host: appDbCredentials.db_host,
      db_port: appDbCredentials.db_port,
      db_name: appDbCredentials.db_name,
      db_user: appDbCredentials.db_user,
      db_password: appDbCredentials.db_password,
    }).eq('id', appId);
    await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Registro de aplicación actualizado.\n`);


    // FASE 2: Instalación de Dependencias y App "Hello World" (usando el script completo)
    await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Ejecutando script de instalación de dependencias en el contenedor ${containerId.substring(0,12)}...\n`);
    const finalInstallScript = DEFAULT_INSTALL_DEPS_SCRIPT.replace(/__CONTAINER_PORT__/g, String(containerPort));
    const encodedScript = Buffer.from(finalInstallScript).toString('base64');
    const { stdout: installStdout, stderr: installStderr, code: installCode } = await executeSshCommand(server, `docker exec ${containerId} bash -c "echo '${encodedScript}' | base64 -d | bash"`);
    if (installCode !== 0) {
      await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] ERROR al instalar dependencias. STDOUT: ${installStdout}\nSTDERR: ${installStderr}\n`);
      throw new Error(`Error al instalar dependencias en el contenedor: ${installStderr || installStdout}`);
    }
    await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Script de instalación completado. STDOUT:\n${installStdout}\n`);

    // FASE 3: Despliegue y Finalización
    await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Buscando dominios de Cloudflare configurados...\n`);
    const { data: cfDomain, error: cfDomainError } = await supabaseAdmin.from('cloudflare_domains').select('id, domain_name, api_token, zone_id, account_id').limit(1).single();
    if (cfDomainError || !cfDomain) {
      await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] ERROR: No hay dominios de Cloudflare configurados. STDERR: ${cfDomainError?.message || 'No data'}\n`);
      throw new Error('No hay dominios de Cloudflare configurados. Asegúrate de añadir uno en la gestión de servidores.');
    }
    await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Dominio de Cloudflare '${cfDomain.domain_name}' encontrado.\n`);

    await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Creando y aprovisionando túnel Cloudflare...\n`);
    const { tunnelData } = await createAndProvisionCloudflareTunnel({ userId, serverId: server.id, containerId, cloudflareDomainId: cfDomain.id, containerPort, hostPort, subdomain: containerName, serverDetails: server, cloudflareDomainDetails: cfDomain });
    await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Túnel Cloudflare '${tunnelData.full_domain}' aprovisionado. ID: ${tunnelData.id}\n`);

    await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Actualizando estado de la aplicación a 'ready' y URL final...\n`);
    await updateAppStatus(appId, 'ready', { url: `https://${tunnelData.full_domain}`, tunnel_id: tunnelData.id });
    await supabaseAdmin.from('server_events_log').insert({
      user_id: userId,
      event_type: 'app_provisioning_succeeded',
      description: `Aplicación '${appName}' (ID: ${appId}) aprovisionada exitosamente. URL: ${tunnelData.full_domain}`,
      server_id: serverIdForLog,
      command_details: `Container ID: ${containerId}, Host Port: ${hostPort}, Tunnel ID: ${tunnelData.id}`,
    });
    await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Aprovisionamiento de la aplicación completado exitosamente.\n`);

  } catch (error: any) {
    console.error(`[App Provisioning] Failed for app ${appId}:`, error);
    await updateAppStatus(appId, 'failed');
    
    // Log the specific error to server_events_log
    await supabaseAdmin.from('server_events_log').insert({
      user_id: userId,
      event_type: 'app_provisioning_failed',
      description: `Fallo en el aprovisionamiento de la aplicación '${appName}' (ID: ${appId}). Error: ${error.message}`,
      server_id: serverIdForLog, // Use the stored serverId
      command_details: `Container ID: ${containerId || 'N/A'}`,
    });

    if (containerId && server && containerName) {
      try {
        await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Limpiando recursos del contenedor ${containerId.substring(0,12)} debido a un fallo...\n`);
        await executeSshCommand(server, `docker rm -f ${containerId}`);
        await executeSshCommand(server, `docker volume rm ${containerName}-app-data`);
        await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Recursos del contenedor limpiados.\n`);
      } catch (cleanupError) {
        console.error(`[App Provisioning] Failed to cleanup container ${containerId} for failed app ${appId}:`, cleanupError);
        await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] ERROR al limpiar recursos del contenedor: ${cleanupError}\n`);
      }
    }
    await appendToServerProvisioningLog(serverIdForLog, `[App Provisioning] Aprovisionamiento de la aplicación fallido. Error: ${error.message}\n`);
  }
}