import * as z from 'zod';

export const createContainerFormSchema = z.object({
  image: z.string().min(1, { message: 'La imagen es requerida.' }),
  name: z.string().optional(),
  cloudflare_domain_id: z.string().uuid({ message: 'ID de dominio de Cloudflare inválido.' }).optional(),
  container_port: z.coerce.number().int().min(1).max(65535, { message: 'Puerto de contenedor inválido.' }).optional(),
  host_port: z.coerce.number().int().min(1).max(65535, { message: 'Puerto del host inválido.' }).optional(),
  subdomain: z.string().regex(/^[a-z0-9-]{1,63}$/, { message: 'Subdominio inválido. Solo minúsculas, números y guiones.' }).optional(),
  script_install_deps: z.string().min(1, { message: 'El script de instalación de dependencias es requerido.' }),
});

export type CreateContainerFormValues = z.infer<typeof createContainerFormSchema>;

export const DEFAULT_INSTALL_DEPS_SCRIPT = `
set -ex # -e: exit on error, -x: print commands and arguments as they are executed
export DEBIAN_FRONTEND=noninteractive

echo "--- Initial apt update... ---"
apt-get update -y || { echo "ERROR: initial apt-get update failed"; exit 1; }
echo "--- Initial apt update complete. ---"

echo "--- Installing sudo... ---"
apt-get install -y sudo || { echo "ERROR: sudo installation failed"; exit 1; }
echo "--- sudo installed. ---"

echo "--- Verifying Node.js and npm installation... ---"
echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"
echo "--- Node.js and npm are pre-installed. ---"

echo "--- Installing cloudflared... ---"
# Add cloudflare gpg key
sudo mkdir -p --mode=0755 /usr/share/keyrings || { echo "ERROR: mkdir /usr/share/keyrings failed"; exit 1; }
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null || { echo "ERROR: adding cloudflare gpg key failed"; exit 1; }
chmod a+r /usr/share/keyrings/cloudflare-main.gpg # Ensure correct permissions

# Add this repo to your apt repositories
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list >/dev/null || { echo "ERROR: adding cloudflared repo failed"; exit 1; }

# install cloudflared
sudo apt-get update -y && sudo apt-get install -y cloudflared || { echo "ERROR: cloudflared installation failed"; exit 1; }

echo "--- Verifying cloudflared installation ---"
which cloudflared || { echo "ERROR: cloudflared binary not found in PATH"; exit 1; }
cloudflared --version || { echo "ERROR: cloudflared --version command failed"; exit 1; }
echo "--- cloudflared installed and verified. ---"

echo "--- Creating Next.js 'hello-world' app in /app directory... ---"
# Run as root, so no sudo needed here. Use --yes to skip prompts.
cd /
npx --yes create-next-app@latest app --use-npm --example "https://github.com/vercel/next.js/tree/canary/examples/hello-world" || { echo "ERROR: create-next-app failed"; exit 1; }
echo "--- Next.js app created. ---"

echo "--- Installing Next.js app dependencies... ---"
cd /app
npm install || { echo "ERROR: npm install failed"; exit 1; }
echo "--- Dependencies installed. ---"

echo "--- Starting Next.js dev server in the background... ---"
# Run the dev server in the background using nohup and redirect output
# The __CONTAINER_PORT__ placeholder will be replaced by the backend with the correct port.
nohup npm run dev -- -p __CONTAINER_PORT__ > /app/dev.log 2>&1 &
echo "--- Next.js dev server started. Check /app/dev.log for output. ---"

echo "--- Container dependency installation complete ---"
`;

export const TUNNEL_CREATION_SUMMARY_SCRIPT = `
# Resumen de la secuencia de creación del túnel Cloudflare (ejecutado en el backend)

# 1. Verificar túneles existentes para el contenedor y puerto.
# 2. Crear un nuevo túnel Cloudflare a través de la API de Cloudflare.
#    - Se genera un ID de túnel y un token.
# 3. Generar un subdominio (si no se proporciona) y construir el dominio completo.
# 4. Crear un registro DNS CNAME en Cloudflare apuntando el dominio completo al túnel.
# 5. Guardar los detalles del túnel en la base de datos (tabla 'docker_tunnels').
# 6. Configurar las reglas de ingreso del túnel a través de la API de Cloudflare:
#    - Redirige el tráfico del dominio completo a 'http://localhost:[PUERTO_CONTENEDOR]'.
#    - Se mantiene 'noTLSVerify: true' para la conexión interna, por si el origen fuera HTTPS con certificado auto-firmado.
# 7. Instalar y ejecutar el cliente 'cloudflared' dentro del contenedor Docker:
#    - Se crea el directorio '/root/.cloudflared'.
#    - Se escriben los archivos de credenciales y configuración ('config.yml') del túnel.
#    - Se ejecuta 'cloudflared tunnel run [ID_TUNNEL]' en segundo plano dentro del contenedor.
# 8. Actualizar el estado del túnel a 'activo' en la base de datos.
# 9. Registrar el evento de creación del túnel en el historial del servidor.

# En caso de fallo en cualquier paso, se intenta revertir las acciones realizadas (eliminar túnel, registro DNS, etc.).
`;

export const INITIAL_CREATE_CONTAINER_DEFAULTS: CreateContainerFormValues = {
  image: 'node:lts-bookworm',
  name: '',
  cloudflare_domain_id: undefined,
  container_port: 3000,
  host_port: undefined,
  subdomain: undefined,
  script_install_deps: DEFAULT_INSTALL_DEPS_SCRIPT,
};