#!/bin/bash

# ==============================================================================
# Script de Instalación/Actualización para la Aplicación de Chat con IA
# ==============================================================================
#
# Este script automatiza la instalación y configuración de la aplicación
# en un servidor Linux (probado en Ubuntu 22.04).
#
# Prerrequisitos:
#   - Acceso `sudo` en el servidor.
#   - `git` y `curl` instalados (`sudo apt update && sudo apt install git curl`).
#
# Uso:
#   1. Guarda este script como `install.sh` en la raíz de tu proyecto.
#   2. Dale permisos de ejecución: `chmod +x install.sh`.
#   3. Ejecútalo: `./install.sh`.
#
#   Para actualizaciones, simplemente ejecuta el script de nuevo desde la raíz del proyecto.
#
# Variables de Entorno Requeridas (deben estar disponibles en el entorno de ejecución):
#   - NEXT_PUBLIC_SUPABASE_URL
#   - NEXT_PUBLIC_SUPABASE_ANON_KEY
#   - SUPABASE_SERVICE_ROLE_KEY
#   - ENCRYPTION_KEY
#   - WEBSOCKET_PORT (por defecto 3001 si no se especifica)
#
# ==============================================================================

set -e # Salir inmediatamente si un comando falla.

# --- Variables de Configuración ---
# Ya no necesitamos REPO_URL ni PROJECT_DIR, asumimos que estamos en la raíz del proyecto.
NEXT_APP_NAME="chat-app-next"
WS_APP_NAME="chat-app-ws"
NODE_MAJOR_VERSION=22

# --- Funciones de Ayuda ---
function check_command() {
  if ! command -v "$1" &> /dev/null; then
    echo "Error: El comando '$1' no se encuentra. Por favor, instálalo."
    exit 1
  fi
}

function setup_nodejs() {
  echo "--- Comprobando la instalación de Node.js v${NODE_MAJOR_VERSION} ---"
  if command -v node &> /dev/null; then
    CURRENT_NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$CURRENT_NODE_VERSION" == "$NODE_MAJOR_VERSION" ]; then
      echo "Node.js v${NODE_MAJOR_VERSION} ya está instalado. Omitiendo."
      return
    else
      echo "Se encontró una versión diferente de Node.js (v${CURRENT_NODE_VERSION}). Se recomienda usar la v${NODE_MAJOR_VERSION}."
      read -p "¿Deseas continuar con la versión actual o instalar la v${NODE_MAJOR_VERSION}? (c/i): " choice
      if [ "$choice" == "c" ]; then
        echo "Continuando con la versión actual de Node.js."
        return
      fi
    fi
  fi

  echo "Instalando Node.js v${NODE_MAJOR_VERSION} usando NodeSource..."
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg
  sudo mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR_VERSION.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
  sudo apt-get update
  sudo apt-get install nodejs sshpass -y
  echo "Node.js v${NODE_MAJOR_VERSION} instalado correctamente."
  node -v
  npm -v
}

function setup_pm2() {
  if ! command -v pm2 &> /dev/null; then
    echo "PM2 no está instalado. Instalando globalmente con npm..."
    sudo npm install pm2 -g
  fi
}

function setup_crontab() {
  echo "--- Configurando tareas CRON para la gestión del ciclo de vida de la aplicación ---"
  # Definir la URL del endpoint de CRON
  CRON_URL_PATTERN="/api/cron/manage-app-lifecycle"
  # Usar WEBSOCKET_PORT del entorno, con un valor por defecto si no está definido
  LOCAL_WEBSOCKET_PORT=${WEBSOCKET_PORT:-3001}
  CRON_JOB="*/5 * * * * curl -s http://localhost:${LOCAL_WEBSOCKET_PORT}${CRON_URL_PATTERN} > /dev/null 2>&1"
  
  # Eliminar cualquier tarea CRON existente que apunte a este endpoint
  echo "Eliminando tareas CRON antiguas para ${CRON_URL_PATTERN} (si existen)..."
  (sudo crontab -l 2>/dev/null | grep -v "${CRON_URL_PATTERN}") | sudo crontab - || true
  echo "Tareas CRON antiguas eliminadas."

  # Comprobar si la tarea CRON ya existe (después de la limpieza)
  if ! sudo crontab -l | grep -Fq "$CRON_JOB"; then
    echo "Añadiendo nueva tarea CRON: $CRON_JOB"
    (sudo crontab -l 2>/dev/null; echo "$CRON_JOB") | sudo crontab -
    echo "Tarea CRON añadida correctamente."
  else
    echo "La tarea CRON ya existe. Omitiendo."
  fi
}

function create_env_file() {
  echo "--- Creando archivo .env.local ---"
  # Usar variables de entorno pasadas al script, con valores por defecto si no están definidas
  cat << EOF > .env.local
# Supabase
NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

# Clave de cifrado para secretos (¡NO CAMBIAR DESPUÉS DE LA PRIMERA INSTALACIÓN!)
ENCRYPTION_KEY="${ENCRYPTION_KEY}"

# Puerto para el servidor de WebSockets
WEBSOCKET_PORT=${WEBSOCKET_PORT:-3001}
EOF
  echo "Archivo .env.local creado con éxito."
}

# --- Inicio del Script Principal ---
echo ">>> Iniciando el despliegue/actualización de la aplicación..."

# --- Paso 1: Verificar Prerrequisitos ---
echo "--- Paso 1: Verificando prerrequisitos (git, curl)... ---"
check_command "git"
check_command "curl"

# --- Paso 2: Instalar Node.js ---
setup_nodejs

# --- Paso 3: Actualizar Repositorio (asumiendo que ya estamos en el directorio del proyecto) ---
echo "--- Paso 3: Actualizando el repositorio (git pull)... ---"
# Asegurarse de que estamos en un repositorio git
if [ ! -d ".git" ]; then
  echo "Error: No es un repositorio Git. Por favor, clona el repositorio primero o ejecuta este script desde la raíz del proyecto."
  exit 1
fi
git pull origin main
echo "Repositorio actualizado correctamente."

# --- Paso 4: Configuración de Variables de Entorno ---
# Siempre crear o sobrescribir .env.local para asegurar que las últimas variables se usen
create_env_file

# --- Paso 5: Instalar Dependencias ---
echo "--- Paso 5: Instalando dependencias con npm... ---"
npm install

# --- Paso 6: Construir la Aplicación Next.js ---
echo "--- Paso 6: Construyendo la aplicación Next.js para producción... ---"
npm run build

# --- Paso 7: Configurar y Usar PM2 ---
echo "--- Paso 7: Configurando y arrancando la aplicación con PM2... ---"
setup_pm2

# Detener procesos antiguos si existen para un reinicio limpio
echo "Deteniendo instancias antiguas de la aplicación en PM2 (si existen)..."
pm2 delete "$NEXT_APP_NAME" || true
pm2 delete "$WS_APP_NAME" || true

# Iniciar la aplicación Next.js
echo "Iniciando servidor Next.js con PM2..."
pm2 start npm --name "$NEXT_APP_NAME" -- start

# Iniciar el servidor de WebSockets
echo "Iniciando servidor de WebSockets con PM2..."
pm2 start "ts-node" --name "$WS_APP_NAME" -- server/websocket.ts

# Guardar la lista de procesos de PM2 para que se reinicien con el servidor
pm2 save
echo "Lista de procesos de PM2 guardada para el reinicio automático del servidor."

# --- Paso 8: Configurar Tareas CRON ---
setup_crontab

# --- Fin del Script ---
echo ""
echo ">>> ¡Despliegue/Actualización completado!"
echo ""
echo "Tu aplicación ahora está corriendo bajo PM2."
echo "Puedes ver el estado de los procesos con el comando: pm2 list"
echo "Puedes ver los logs en tiempo real con: pm2 logs"
echo ""
echo "NOTA: Para que tu aplicación sea accesible desde internet en el puerto 80 (HTTP) o 443 (HTTPS),"
echo "normalmente configurarías un servidor web como Nginx o Apache como un 'reverse proxy'."