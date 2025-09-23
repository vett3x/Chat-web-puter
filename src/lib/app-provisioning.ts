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

async function runValidationAndFix(server: any, containerId: string, generatedFiles: Map<string, string>, appId: string, userId: string): Promise<boolean> {
  const { code, stderr } = await executeSshCommand(server, `docker exec ${containerId} npx tsc --noEmit`);
  if (code === 0) {
    console.log(`[Provisioning] TypeScript validation successful for app ${appId}.`);
    return true; // Success
  }

  console.warn(`[Provisioning] Validation failed. Error: ${stderr}`);
  const match = stderr.match(/([a-zA-Z0-9/.-]+\.tsx?)/);
  if (!match) throw new Error(`Validation failed, and could not identify problematic file from error: ${stderr}`);
  
  const problematicFilePath = match[1];
  const fileContent = generatedFiles.get(problematicFilePath);
  if (!fileContent) throw new Error(`Validation failed in ${problematicFilePath}, but its content was not found.`);

  const fixPrompt = `La compilación de la aplicación Next.js falló con el siguiente error de TypeScript:\n--- ERROR ---\n${stderr}\n--- FIN DEL ERROR ---\nEl error parece estar en el archivo "${problematicFilePath}". Aquí está el código actual de ese archivo:\n--- CÓDIGO ACTUAL ---\n${fileContent}\n--- FIN DEL CÓDIGO ---\nPor favor, corrige el error en el código. Responde ÚNICAMENTE con el código fuente completo y corregido para el archivo "${problematicFilePath}". No incluyas explicaciones.`;
  const fixResponse = await (global as any).puter.ai.chat([{ role: 'user', content: fixPrompt }], { model: 'claude-opus-4' });
  const fixedContent = fixResponse.message.content;

  await writeAppFile(server, containerId, problematicFilePath, fixedContent, appId, userId);
  generatedFiles.set(problematicFilePath, fixedContent);
  return false; // Indicates that a fix was attempted
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
    const runCommand = `docker run -d --name ${containerName} -p ${hostPort}:${containerPort} --entrypoint tail node:lts-bookworm -f /dev/null`;
    
    const { stdout: newContainerId, stderr: runStderr, code: runCode } = await executeSshCommand(server, runCommand);
    if (runCode !== 0) throw new Error(`Error al crear el contenedor: ${runStderr}`);
    containerId = newContainerId.trim();

    await supabaseAdmin.from('user_apps').update({ server_id: server.id, container_id: containerId }).eq('id', appId);

    const finalInstallScript = DEFAULT_INSTALL_DEPS_SCRIPT.replace(/__CONTAINER_PORT__/g, String(containerPort));
    const encodedScript = Buffer.from(finalInstallScript).toString('base64');
    const { stderr: installStderr, code: installCode } = await executeSshCommand(server, `docker exec ${containerId} bash -c "echo '${encodedScript}' | base64 -d | bash"`);
    if (installCode !== 0) throw new Error(`Error al instalar dependencias en el contenedor: ${installStderr}`);

    // FASE 2: Planificación y Generación de Código Paralela
    const planningPrompt = `Tu tarea es actuar como un arquitecto de software senior. Analiza la solicitud del usuario y crea un plan de archivos detallado para una aplicación Next.js con TypeScript y Tailwind CSS. La salida DEBE ser un único objeto JSON. El JSON debe tener una clave "files", que es un array de objetos. Cada objeto debe tener tres claves: "path" (string), "description" (string), y "dependencies" (un array de strings, donde cada string es la ruta a otro archivo en este plan). Las dependencias deben ser solo los archivos necesarios para que el archivo actual se escriba correctamente. Solicitud del Usuario: "${prompt}"`;
    const planningResponse = await (global as any).puter.ai.chat([{ role: 'user', content: planningPrompt }], { model: 'claude-opus-4' });
    const plan: { files: FilePlan[] } = JSON.parse(planningResponse.message.content);
    const generatedFilesContent = new Map<string, string>();
    const filesToProcess = new Set(plan.files.map(f => f.path));
    const maxRetries = plan.files.length + 3; // Allow a few extra retries
    let retries = 0;

    while (filesToProcess.size > 0 && retries < maxRetries) {
      const readyFiles = plan.files.filter(f => filesToProcess.has(f.path) && f.dependencies.every(dep => generatedFilesContent.has(dep)));
      if (readyFiles.length === 0) throw new Error("Ciclo de dependencias detectado o no se pueden procesar más archivos.");

      const generationPromises = readyFiles.map(async (file) => {
        let context = `El objetivo general de la aplicación es: "${prompt}".\n\nAhora estás creando el archivo en la ruta: "${file.path}".\nEl propósito de este archivo es: "${file.description}".\n\n`;
        if (file.dependencies && file.dependencies.length > 0) {
          context += "Para ayudarte, aquí está el contenido de los archivos de los que depende:\n\n";
          for (const depPath of file.dependencies) {
            if (generatedFilesContent.has(depPath)) {
              context += `--- INICIO DEL ARCHIVO: ${depPath} ---\n${generatedFilesContent.get(depPath)}\n--- FIN DEL ARCHIVO: ${depPath} ---\n\n`;
            }
          }
        }
        const generationPrompt = `${context}Ahora, escribe el código fuente completo y listo para producción para "${file.path}". Responde ÚNICAMENTE con el código. No incluyas explicaciones, markdown, ni nada más.`;
        const codeResponse = await (global as any).puter.ai.chat([{ role: 'user', content: generationPrompt }], { model: 'claude-opus-4' });
        return { path: file.path, content: codeResponse.message.content };
      });

      const generatedBatch = await Promise.all(generationPromises);

      for (const { path, content } of generatedBatch) {
        await writeAppFile(server, containerId, path, content, appId, userId);
        generatedFilesContent.set(path, content);
        filesToProcess.delete(path);
      }

      // FASE 3: Validación Continua y Auto-Corrección
      const isBatchValid = await runValidationAndFix(server, containerId, generatedFilesContent, appId, userId);
      if (!isBatchValid) {
        // If a fix was attempted, we re-run the validation on the next loop iteration
        // to confirm the fix worked before proceeding.
        retries++;
      }
    }
    if (filesToProcess.size > 0) throw new Error("No se pudieron generar todos los archivos después de múltiples intentos.");

    // FASE 4: Smoke Test de Ejecución
    const { code: devCode, stderr: devStderr } = await executeSshCommand(server, `docker exec ${containerId} sh -c "npm run dev > /dev/null 2>&1 &"`);
    if (devCode !== 0) throw new Error(`No se pudo iniciar el servidor de desarrollo: ${devStderr}`);
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for server to start
    const { code: curlCode } = await executeSshCommand(server, `docker exec ${containerId} curl --fail http://localhost:3000`);
    if (curlCode !== 0) throw new Error("La aplicación compiló pero falló al iniciarse (Smoke Test fallido).");

    // FASE 5: Despliegue y Finalización
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