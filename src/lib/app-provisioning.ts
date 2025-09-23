"use server";

import { createClient } from '@supabase/supabase-js';
import { createAndProvisionCloudflareTunnel } from '@/lib/tunnel-orchestration';
import { executeSshCommand } from './ssh-utils';
import { generateRandomPort } from '@/lib/utils';
import { DEFAULT_INSTALL_DEPS_SCRIPT } from '@/components/server-detail-tabs/docker/create-container-constants';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AppProvisioningData {
  appId: string;
  userId: string;
  appName: string;
  conversationId: string;
  prompt: string;
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

export async function provisionApp(data: AppProvisioningData) {
  const { appId, userId, appName, conversationId, prompt } = data;
  let containerId: string | undefined;
  let server: any;

  try {
    // FASE 1: Configuración del Entorno
    const { data: serverData, error: serverError } = await supabaseAdmin.from('user_servers').select('id, ip_address, ssh_port, ssh_username, ssh_password, name').eq('status', 'ready').limit(1).single();
    if (serverError || !serverData) throw new Error('No hay servidores listos disponibles.');
    server = serverData;

    const containerPort = 3000;
    const hostPort = generateRandomPort();
    const containerName = `app-${appName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${appId.substring(0, 8)}`;
    
    // Se crea un contenedor base que se mantendrá en ejecución para poder instalar dependencias dentro.
    const runCommand = `docker run -d --name ${containerName} -p ${hostPort}:${containerPort} --entrypoint tail node:lts-bookworm -f /dev/null`;
    
    const { stdout: newContainerId, stderr: runStderr, code: runCode } = await executeSshCommand(server, runCommand);
    if (runCode !== 0) throw new Error(`Error al crear el contenedor: ${runStderr}`);
    containerId = newContainerId.trim();

    await supabaseAdmin.from('user_apps').update({ server_id: server.id, container_id: containerId }).eq('id', appId);

    // FASE 2: Instalación de Dependencias (usando el script completo)
    const finalInstallScript = DEFAULT_INSTALL_DEPS_SCRIPT.replace(/__CONTAINER_PORT__/g, String(containerPort));
    const encodedScript = Buffer.from(finalInstallScript).toString('base64');
    const { stderr: installStderr, code: installCode } = await executeSshCommand(server, `docker exec ${containerId} bash -c "echo '${encodedScript}' | base64 -d | bash"`);
    if (installCode !== 0) throw new Error(`Error al instalar dependencias en el contenedor: ${installStderr}`);

    // FASE 3: Despliegue y Finalización
    const { data: cfDomain, error: cfDomainError } = await supabaseAdmin.from('cloudflare_domains').select('id, domain_name, api_token, zone_id, account_id').limit(1).single();
    if (cfDomainError || !cfDomain) throw new Error('No hay dominios de Cloudflare configurados.');

    const { tunnelData } = await createAndProvisionCloudflareTunnel({ userId, serverId: server.id, containerId, cloudflareDomainId: cfDomain.id, containerPort, hostPort, subdomain: containerName, serverDetails: server, cloudflareDomainDetails: cfDomain });

    await updateAppStatus(appId, 'ready', { url: `https://${tunnelData.full_domain}`, tunnel_id: tunnelData.id });

  } catch (error: any) {
    console.error(`[Provisioning] Failed for app ${appId}:`, error);
    await updateAppStatus(appId, 'failed');
    if (containerId && server) {
      try {
        await executeSshCommand(server, `docker rm -f ${containerId}`);
      } catch (cleanupError) {
        console.error(`[Provisioning] Failed to cleanup container ${containerId} for failed app ${appId}:`, cleanupError);
      }
    }
  }
}