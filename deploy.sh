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

# --- Funciones de Ayuda ---
function check_command() {
  if ! command -v $1 &> /dev/null; then
    echo "Error: El comando '$1' no se encuentra. Por favor, instálalo."
    exit 1
  fi
}

function setup_dependencies() {
    echo "--- Instalando dependencias del sistema (git, curl, sshpass)... ---"
    sudo apt-get update
    sudo apt-get install -y git curl sshpass
}

function setup_nodejs() {
  echo "--- Comprobando la instalación de Node.js v${NODE_MAJOR_VERSION} ---"
  if command -v node &> /dev/null; then
    CURRENT_NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$CURRENT_NODE_VERSION" == "$NODE_MAJOR_VERSION" ]; then
      echo "Node.js v${NODE_MAJOR_VERSION} ya está instalado. Omitiendo."
      return
    else
      echo "Se encontró una versión diferente de Node.js (v${CURRENT_NODE_VERSION}). Se procederá a instalar la v${NODE_MAJOR_VERSION}."
    fi
  fi

  echo "Instalando Node.js v${NODE_MAJOR_VERSION} usando NodeSource..."
  # Instalar dependencias para añadir repositorios
  sudo apt-get update
  sudo apt-get install -y ca-certificates

  # Añadir la clave GPG de NodeSource
  sudo mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg

  # Añadir el repositorio de NodeSource
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR_VERSION.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list

  # Instalar Node.js
  sudo apt-get update
  sudo apt-get install nodejs -y
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

# --- Inicio del Script ---
echo ">>> Iniciando el despliegue de la aplicación..."

# --- Paso 1: Instalar Dependencias del Sistema ---
setup_dependencies

# --- Paso 2: Instalar Node.js v22 ---
setup_nodejs

# --- Paso 3: Clonar el Repositorio ---
if [ -d "$PROJECT_DIR" ]; then
  echo "--- El directorio '$PROJECT_DIR' ya existe. Omitiendo clonación. ---"
else
  echo "--- Paso 3: Clonando el repositorio desde GitHub... ---"
  git clone "$REPO_URL"
fi

cd "$PROJECT_DIR"
echo "Navegando al directorio del proyecto: $(pwd)"

# --- Paso 4: Configuración de Variables de Entorno ---
echo ""
echo "--- Paso 4: ACCIÓN REQUERIDA - Configuración del entorno ---"
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
    echo "Error: El archivo .env.local no fue encontrado. Abortando."
    exit 1
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