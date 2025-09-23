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

async function writeAppFile(server: any, containerId: string, filePath: string, content: string, appId: string, userId: string) {
  const encodedContent = Buffer.from(content).toString('base64');
  const command = `bash -c "mkdir -p /app/$(dirname '${filePath}') && echo '${encodedContent}' | base64 -d > /app/${filePath}"`;
  const { stderr, code } = await executeSshCommand(server, `docker exec ${containerId} ${command}`);
  if (code !== 0) throw new Error(`Error al escribir en el archivo del contenedor: ${stderr}`);

  await supabaseAdmin.from('app_file_backups').upsert({
    app_id: appId,
    user_id: userId,
    file_path: filePath,
    file_content: content,
  }, { onConflict: 'app_id, file_path' });
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
    
    // Modificado: El entrypoint ahora inicia un simple servidor Node.js
    const runCommand = `docker run -d --name ${containerName} -p ${hostPort}:${containerPort} --entrypoint node node:lts-bookworm -e "require('http').createServer((req, res) => res.end('Entorno listo. La generación de código comenzará en el chat.')).listen(${containerPort})"`;
    
    const { stdout: newContainerId, stderr: runStderr, code: runCode } = await executeSshCommand(server, runCommand);
    if (runCode !== 0) throw new Error(`Error al crear el contenedor: ${runStderr}`);
    containerId = newContainerId.trim();

    await supabaseAdmin.from('user_apps').update({ server_id: server.id, container_id: containerId }).eq('id', appId);

    // FASE 2: Despliegue y Finalización (sin generación de código)
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