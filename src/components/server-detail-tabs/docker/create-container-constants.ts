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

echo "--- Installing sudo (if not present)... ---"
apt-get install -y sudo || { echo "WARNING: sudo installation failed or already present. Continuing..."; }
echo "--- sudo check complete. ---"

echo "--- Installing core dependencies (curl, gnupg, lsb-release, apt-utils, git)..."
sudo apt-get install -y curl gnupg lsb-release apt-utils git || { echo "ERROR: core dependencies installation failed"; exit 1; }
echo "--- Core dependencies installed. ---"

echo "--- Verifying Node.js and npm installation... ---"
node -v || { echo "ERROR: Node.js not found. Base image issue?"; exit 1; }
npm -v || { echo "ERROR: npm not found. Base image issue?"; exit 1; }
echo "--- Node.js and npm are present. ---"

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

echo "--- Creating minimal Next.js app structure in /app directory... ---"
mkdir -p /app/src/app || { echo "ERROR: mkdir /app/src/app failed"; exit 1; }
cd /app

# Create package.json
cat <<EOF > package.json
{
  "name": "my-next-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "latest",
    "react": "latest",
    "react-dom": "latest"
  },
  "devDependencies": {
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "autoprefixer": "latest",
    "eslint": "latest",
    "eslint-config-next": "latest",
    "postcss": "latest",
    "tailwindcss": "latest",
    "typescript": "latest"
  }
}
EOF

# Create next.config.mjs
cat <<EOF > next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
EOF

# Create postcss.config.mjs
cat <<EOF > postcss.config.mjs
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
EOF

# Create tailwind.config.ts
cat <<EOF > tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};
export default config;
EOF

# Create src/app/globals.css
cat <<EOF > src/app/globals.css
@tailwind base;
@tailwind components;
@tailwind utilities;
EOF

# Create src/app/layout.tsx
cat <<EOF > src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Create Next App',
  description: 'Generated by create next app',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
EOF

# Create src/app/page.tsx
cat <<EOF > src/app/page.tsx
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold">Welcome to your Next.js App!</h1>
      <p className="text-lg">Start building with DeepAI Coder.</p>
    </main>
  );
}
EOF

echo "--- Minimal Next.js app structure created. ---"

echo "--- Installing Next.js app dependencies... ---"
npm install || { echo "ERROR: npm install failed"; exit 1; }
echo "--- Dependencies installed. ---"

echo "--- Starting Next.js dev server in the background... ---"
# Run the dev server in the background using nohup and redirect output
# The __CONTAINER_PORT__ placeholder will be replaced by the backend with the correct port.
nohup npm run dev -- --hostname 0.0.0.0 -p __CONTAINER_PORT__ > /app/dev.log 2>&1 &
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
#    - Se ejecuta 'cloudflared tunnel run [ID_TUNEL]' en segundo plano dentro del contenedor.
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