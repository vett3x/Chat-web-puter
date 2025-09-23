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

interface FilePlan {
  path: string;
  description: string;
  dependencies: string[];
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

    // --- START: CONTEXT-AWARE INCREMENTAL CODE GENERATION ---
    // 4. AI Planning: Generate a detailed file plan with dependencies
    const planningPrompt = `
      Tu tarea es actuar como un arquitecto de software senior. Analiza la solicitud del usuario y crea un plan de archivos detallado para una aplicación Next.js con TypeScript y Tailwind CSS.
      La salida DEBE ser un único objeto JSON.
      El JSON debe tener una clave "files", que es un array de objetos.
      Cada objeto debe tener tres claves: "path" (string), "description" (string), y "dependencies" (un array de strings, donde cada string es la ruta a otro archivo en este plan).
      Las dependencias deben ser solo los archivos necesarios para que el archivo actual se escriba correctamente. Por ejemplo, un componente puede depender de un archivo de definición de tipos.
      
      Solicitud del Usuario: "${prompt}"
    `;
    const planningResponse = await (global as any).puter.ai.chat([{ role: 'user', content: planningPrompt }], { model: 'claude-opus-4' });
    const plan: { files: FilePlan[] } = JSON.parse(planningResponse.message.content);
    const generatedFilesContent = new Map<string, string>();

    // 5. AI Generation: Generate code for each file using the plan
    for (const file of plan.files) {
      let context = `El objetivo general de la aplicación es: "${prompt}".\n\n`;
      context += `Ahora estás creando el archivo en la ruta: "${file.path}".\n`;
      context += `El propósito de este archivo es: "${file.description}".\n\n`;

      if (file.dependencies && file.dependencies.length > 0) {
        context += "Para ayudarte, aquí está el contenido de los archivos de los que depende:\n\n";
        for (const depPath of file.dependencies) {
          if (generatedFilesContent.has(depPath)) {
            context += `--- INICIO DEL ARCHIVO: ${depPath} ---\n`;
            context += generatedFilesContent.get(depPath);
            context += `\n--- FIN DEL ARCHIVO: ${depPath} ---\n\n`;
          }
        }
      }

      const generationPrompt = `${context}Ahora, escribe el código fuente completo y listo para producción para "${file.path}". Responde ÚNICAMENTE con el código. No incluyas explicaciones, markdown, ni nada más.`;
      const codeResponse = await (global as any).puter.ai.chat([{ role: 'user', content: generationPrompt }], { model: 'claude-opus-4' });
      const fileContent = codeResponse.message.content;
      
      await writeAppFile(server, containerId, file.path, fileContent, appId, userId);
      generatedFilesContent.set(file.path, fileContent);
    }
    // --- END: CONTEXT-AWARE INCREMENTAL CODE GENERATION ---

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