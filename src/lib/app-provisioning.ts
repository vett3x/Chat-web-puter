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
  prompt: string; // Added prompt
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
  // 1. Write to container for hot-reloading
  const encodedContent = Buffer.from(content).toString('base64');
  const command = `bash -c "mkdir -p /app/$(dirname '${filePath}') && echo '${encodedContent}' | base64 -d > /app/${filePath}"`;
  const { stderr, code } = await executeSshCommand(server, `docker exec ${containerId} ${command}`);
  if (code !== 0) throw new Error(`Error al escribir en el archivo del contenedor: ${stderr}`);

  // 2. Backup to database
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
    // 1. Find an available server
    const { data: serverData, error: serverError } = await supabaseAdmin
      .from('user_servers')
      .select('id, ip_address, ssh_port, ssh_username, ssh_password, name')
      .eq('status', 'ready')
      .limit(1)
      .single();
    if (serverError || !serverData) throw new Error('No hay servidores listos disponibles.');
    server = serverData;

    // 2. Create the container with Next.js environment
    const containerPort = 3000;
    const hostPort = generateRandomPort();
    const containerName = `app-${appName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${appId.substring(0, 8)}`;
    const runCommand = `docker run -d --name ${containerName} -p ${hostPort}:${containerPort} --entrypoint tail node:lts-bookworm -f /dev/null`;
    
    const { stdout: newContainerId, stderr: runStderr, code: runCode } = await executeSshCommand(server, runCommand);
    if (runCode !== 0) throw new Error(`Error al crear el contenedor: ${runStderr}`);
    containerId = newContainerId.trim();

    await supabaseAdmin.from('user_apps').update({ server_id: server.id, container_id: containerId }).eq('id', appId);

    // 3. Install dependencies inside the container
    const finalInstallScript = DEFAULT_INSTALL_DEPS_SCRIPT.replace(/__CONTAINER_PORT__/g, String(containerPort));
    const encodedScript = Buffer.from(finalInstallScript).toString('base64');
    const { stderr: installStderr, code: installCode } = await executeSshCommand(server, `docker exec ${containerId} bash -c "echo '${encodedScript}' | base64 -d | bash"`);
    if (installCode !== 0) throw new Error(`Error al instalar dependencias en el contenedor: ${installStderr}`);

    // --- START: Incremental Code Generation ---
    // 4. AI Planning: Generate file structure
    const planningPrompt = `Basado en la siguiente solicitud de usuario, crea una estructura de archivos y carpetas para una aplicación simple de Next.js con TypeScript y Tailwind CSS. Responde ÚNICAMENTE con un array JSON de strings, donde cada string es la ruta completa del archivo (ej: "src/app/page.tsx").\n\nSolicitud: "${prompt}"`;
    const planningResponse = await (global as any).puter.ai.chat([{ role: 'user', content: planningPrompt }], { model: 'claude-opus-4' });
    const fileList = JSON.parse(planningResponse.message.content);

    // 5. AI Generation: Generate code for each file
    for (const filePath of fileList) {
      const generationPrompt = `Genera el código para el archivo "${filePath}". El objetivo general de la aplicación es: "${prompt}". La estructura de archivos completa es: ${JSON.stringify(fileList)}. Responde ÚNICAMENTE con el código fuente completo para el archivo "${filePath}". No incluyas ninguna explicación ni formato adicional.`;
      const codeResponse = await (global as any).puter.ai.chat([{ role: 'user', content: generationPrompt }], { model: 'claude-opus-4' });
      const fileContent = codeResponse.message.content;
      
      // Write file to container and backup
      await writeAppFile(server, containerId, filePath, fileContent, appId, userId);
    }
    // --- END: Incremental Code Generation ---

    // 6. Find an available Cloudflare domain and provision tunnel
    const { data: cfDomain, error: cfDomainError } = await supabaseAdmin
      .from('cloudflare_domains')
      .select('id, domain_name, api_token, zone_id, account_id')
      .limit(1)
      .single();
    if (cfDomainError || !cfDomain) throw new Error('No hay dominios de Cloudflare configurados.');

    const { tunnelData } = await createAndProvisionCloudflareTunnel({
      userId,
      serverId: server.id,
      containerId,
      cloudflareDomainId: cfDomain.id,
      containerPort,
      hostPort,
      subdomain: containerName,
      serverDetails: server,
      cloudflareDomainDetails: cfDomain,
    });

    // 7. Final update: App is ready!
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