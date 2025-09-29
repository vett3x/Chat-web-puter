#!/bin/bash

# ==============================================================================
# Script de Despliegue para la Aplicación de Chat con IA
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
#   1. Guarda este script como `deploy.sh`.
#   2. Dale permisos de ejecución: `chmod +x deploy.sh`.
#   3. Ejecútalo: `./deploy.sh`.
#
# ==============================================================================

set -e # Salir inmediatamente si un comando falla.

# --- Variables de Configuración ---
REPO_URL="https://github.com/vett3x/Chat-web-puter.git"
PROJECT_DIR="Chat-web-puter"
NEXT_APP_NAME="chat-app-next"
WS_APP_NAME="chat-app-ws"
NODE_MAJOR_VERSION=22

# Variables de entorno para .env.local (¡NO COMPARTIR ESTAS CLAVES PÚBLICAMENTE!)
SUPABASE_URL="https://juxrggowingqlchwfuct.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1eHJnZ293aW5ncWxjaHdmdWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNDY4OTYsImV4cCI6MjA3MzcyMjg5Nn0.Bf05aFnLW_YCAZdCZC2Kgqtf7is9WcORfDagC2Nq0ec"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1eHJnZ293aW5ncWxjaHdmdWN0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImiYXQiOjE3NTgxNDY4OTYsImV4cCI6MjA3MzcyMjg5Nn0.IMgQlqNaEh9RmCAyaQqNLnOJJxEvL3B1zA03m4pCIW4"
ENCRYPTION_KEY="a8f2e7d1c9b0e6a5f4d3c2b1a0e9d8c7b6a5f4d3c2b1a0e9d8c7b6a5f4d3c2b1"
WEBSOCKET_PORT=3001

# --- Funciones de Ayuda ---
function check_command() {
  if ! command -v $1 &> /dev/null; then
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
  # Obtener la IP pública del servidor
  SERVER_IP=$(curl -s ifconfig.me)
  if [ -z "$SERVER_IP" ]; then
    echo "Advertencia: No se pudo obtener la IP del servidor. Usando 'localhost'."
    SERVER_IP="localhost"
  fi

  CRON_JOB="*/5 * * * * curl -s http://${SERVER_IP}:${WEBSOCKET_PORT}/api/cron/manage-app-lifecycle > /dev/null 2>&1"
  
  # Comprobar si la tarea CRON ya existe
  if ! sudo crontab -l | grep -Fq "$CRON_JOB"; then
    echo "Añadiendo tarea CRON: $CRON_JOB"
    (sudo crontab -l 2>/dev/null; echo "$CRON_JOB") | sudo crontab -
    echo "Tarea CRON añadida correctamente."
  else
    echo "La tarea CRON ya existe. Omitiendo."
  fi
}

function create_env_file() {
  echo "--- Creando archivo .env.local ---"
  cat << EOF > .env.local
# Supabase
NEXT_PUBLIC_SUPABASE_URL="${SUPABASE_URL}"
NEXT_PUBLIC_SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

# Clave de cifrado para secretos (¡NO CAMBIAR DESPUÉS DE LA PRIMERA INSTALACIÓN!)
ENCRYPTION_KEY="${ENCRYPTION_KEY}"

# Puerto para el servidor de WebSockets
WEBSOCKET_PORT=${WEBSOCKET_PORT}
EOF
  echo "Archivo .env.local creado con éxito."
}

# --- Inicio del Script Principal ---
echo ">>> Iniciando el despliegue de la aplicación..."

# --- Paso 1: Verificar Prerrequisitos ---
echo "--- Paso 1: Verificando prerrequisitos (git, curl)... ---"
check_command "git"
check_command "curl"

# --- Paso 2: Instalar Node.js ---
setup_nodejs

# --- Paso 3: Clonar o Actualizar Repositorio ---
IS_NEW_INSTALL=false
if [ -d "$PROJECT_DIR" ]; then
  echo "--- El directorio '$PROJECT_DIR' ya existe. Realizando actualización. ---"
  cd "$PROJECT_DIR"
  echo "Navegando al directorio del proyecto: $(pwd)"
  echo "Realizando git pull para obtener los últimos cambios..."
  git pull origin main
else
  echo "--- El directorio '$PROJECT_DIR' no existe. Realizando nueva instalación. ---"
  echo "--- Paso 3: Clonando el repositorio desde GitHub... ---"
  git clone "$REPO_URL"
  cd "$PROJECT_DIR"
  echo "Navegando al directorio del proyecto: $(pwd)"
  IS_NEW_INSTALL=true
fi

# --- Paso 4: Configuración de Variables de Entorno ---
if [ "$IS_NEW_INSTALL" = true ]; then
  create_env_file
else
  echo "--- El archivo .env.local ya debería existir. Omitiendo creación. ---"
  if [ ! -f ".env.local" ]; then
    echo "Advertencia: .env.local no encontrado en una actualización. Creando uno nuevo."
    create_env_file
  fi
fi

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
echo ">>> ¡Despliegue completado!"
echo ""
echo "Tu aplicación ahora está corriendo bajo PM2."
echo "Puedes ver el estado de los procesos con el comando: pm2 list"
echo "Puedes ver los logs en tiempo real con: pm2 logs"
echo ""
echo "NOTA: Para que tu aplicación sea accesible desde internet en el puerto 80 (HTTP) o 443 (HTTPS),"
echo "normalmente configurarías un servidor web como Nginx o Apache como un 'reverse proxy'."