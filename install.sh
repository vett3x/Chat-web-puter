#!/bin/bash

# Script para desplegar la aplicación Chat-web-puter desde GitHub en un servidor Linux.
#
# Prerrequisitos:
# - Un servidor Linux (probado en Ubuntu 22.04).
# - Git instalado (`sudo apt install git`).
# - Node.js (v18 o superior) y npm instalados.
#
# Uso:
# 1. Guarda este script como `install.sh`.
# 2. Dale permisos de ejecución: `chmod +x install.sh`.
# 3. Ejecútalo: `./install.sh`.

set -e # Salir inmediatamente si un comando falla.

# --- Variables ---
REPO_URL="https://github.com/vett3x/Chat-web-puter.git"
PROJECT_DIR="Chat-web-puter"
NEXT_APP_NAME="chat-app-next"
WS_APP_NAME="chat-app-ws"

# --- Funciones de Ayuda ---
function check_command() {
  if ! command -v $1 &> /dev/null; then
    echo "Error: El comando '$1' no se encuentra. Por favor, instálalo."
    exit 1
  fi
}

function setup_pm2() {
  if ! command -v pm2 &> /dev/null; then
    echo "PM2 no está instalado. Instalando globalmente con npm..."
    sudo npm install pm2 -g
  fi
}

# --- Inicio del Script ---
echo "🚀 Iniciando el despliegue de la aplicación..."

# 1. Verificar prerrequisitos
echo "🔎 Verificando prerrequisitos (git, node, npm)..."
check_command "git"
check_command "node"
check_command "npm"

# 2. Clonar el repositorio
if [ -d "$PROJECT_DIR" ]; then
  echo "⚠️ El directorio '$PROJECT_DIR' ya existe. Omitiendo clonación."
else
  echo "📂 Clonando el repositorio desde GitHub..."
  git clone "$REPO_URL"
fi

cd "$PROJECT_DIR"
echo "✅ Navegando al directorio del proyecto: $(pwd)"

# 3. Configuración de variables de entorno (Paso Manual)
echo ""
echo "🛑 ACCIÓN REQUERIDA: Configuración del entorno."
echo "Necesitas crear un archivo '.env.local' con las claves de Supabase."
echo "Copia y pega el siguiente contenido en un nuevo archivo llamado '.env.local':"
echo ""
echo "----------------------------------------------------------------"
cat << EOF
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://juxrggowingqlchwfuct.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1eHJnZ293aW5ncWxjaHdmdWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNDY4OTYsImV4cCI6MjA3MzcyMjg5Nn0.Bf05aFnLW_YCAZdCZC2Kgqtf7is9WcORdDagC2Nq0ec"

# La clave de servicio es un secreto y debe manejarse con cuidado.
# Asegúrate de que este archivo .env.local no se suba a tu repositorio.
SUPABASE_SERVICE_ROLE_KEY="tu_supabase_service_role_key_aqui"

# Puerto para el servidor de WebSockets
WEBSOCKET_PORT=3001
EOF
echo "----------------------------------------------------------------"
echo ""
echo "IMPORTANTE: Reemplaza 'tu_supabase_service_role_key_aqui' con tu clave real de Supabase."
read -p "Una vez que hayas creado y guardado el archivo '.env.local', presiona [Enter] para continuar..."

if [ ! -f ".env.local" ]; then
    echo "❌ Error: El archivo .env.local no fue encontrado. Abortando."
    exit 1
fi

# 4. Instalar dependencias
echo "📦 Instalando dependencias con npm..."
npm install

# 5. Construir la aplicación Next.js para producción
echo "🏗️ Construyendo la aplicación Next.js..."
npm run build

# 6. Compilar el servidor de WebSockets
echo "⚙️ Compilando el servidor de WebSockets..."
# La compilación de Next.js debería manejar los archivos .ts, pero por si acaso, usamos ts-node.
# Para producción real, sería mejor compilarlo a .js con `tsc`.
# Por ahora, PM2 puede ejecutarlo directamente con ts-node.

# 7. Configurar y usar PM2 para ejecutar la aplicación
echo "🚀 Configurando y arrancando la aplicación con PM2..."
setup_pm2

# Detener procesos antiguos si existen
pm2 delete "$NEXT_APP_NAME" || true
pm2 delete "$WS_APP_NAME" || true

# Iniciar la aplicación Next.js
echo "   - Iniciando servidor Next.js..."
pm2 start npm --name "$NEXT_APP_NAME" -- start

# Iniciar el servidor de WebSockets
echo "   - Iniciando servidor de WebSockets..."
pm2 start "ts-node" --name "$WS_APP_NAME" -- server/websocket.ts

# Guardar la lista de procesos de PM2 para que se reinicien con el servidor
pm2 save
echo "💾 Lista de procesos de PM2 guardada."

# --- Fin del Script ---
echo ""
echo "✅ ¡Despliegue completado!"
echo ""
echo "Tu aplicación ahora está corriendo bajo PM2."
echo "Puedes ver el estado de los procesos con el comando: pm2 list"
echo "Puedes ver los logs en tiempo real con: pm2 logs"
echo ""
echo "NOTA: Para que tu aplicación sea accesible desde internet en el puerto 80 (HTTP) o 443 (HTTPS),"
echo "normalmente configurarías un servidor web como Nginx o Apache como un 'reverse proxy'."