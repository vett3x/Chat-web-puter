#!/bin/bash

# ==============================================================================
# Script de Actualización para la Aplicación de Chat con IA
# ==============================================================================
#
# Este script automatiza la actualización de la aplicación
# en un servidor Linux (probado en Ubuntu 22.04).
#
# Prerrequisitos:
#   - Acceso `sudo` en el servidor.
#   - `git` y `curl` instalados (`sudo apt update && sudo apt install git curl`).
#   - Node.js y npm instalados.
#   - PM2 instalado globalmente.
#   - El archivo `.env.local` debe existir en la raíz del proyecto con las variables de entorno necesarias.
#
# Uso:
#   1. Guarda este script como `update.sh` en la raíz de tu proyecto.
#   2. Dale permisos de ejecución: `chmod +x update.sh`.
#   3. Ejecútalo: `./update.sh`.
#
#   Este script asume que ya estás en la raíz del proyecto.
#
# Variables de Entorno Requeridas (deben estar disponibles en el entorno de ejecución o en .env.local):
#   - WEBSOCKET_PORT (por defecto 3001 si no se especifica)
#
# ==============================================================================

set -e # Salir inmediatamente si un comando falla.

# --- Variables de Configuración ---
NEXT_APP_NAME="chat-app-next"
WS_APP_NAME="chat-app-ws"
NODE_MAJOR_VERSION=22 # Se mantiene para la verificación de Node.js, aunque no se instala aquí.

# --- Funciones de Ayuda ---
function check_command() {
  if ! command -v "$1" &> /dev/null; then
    echo "Error: El comando '$1' no se encuentra. Por favor, instálalo."
    exit 1
  fi
}

function setup_nodejs_check() {
  echo "--- Comprobando la instalación de Node.js v${NODE_MAJOR_VERSION} ---"
  if command -v node &> /dev/null; then
    CURRENT_NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$CURRENT_NODE_VERSION" == "$NODE_MAJOR_VERSION" ]; then
      echo "Node.js v${NODE_MAJOR_VERSION} ya está instalado. Correcto."
      return
    else
      echo "Advertencia: Se encontró una versión diferente de Node.js (v${CURRENT_NODE_VERSION}). Se recomienda usar la v${NODE_MAJOR_VERSION}."
      echo "Por favor, instala Node.js v${NODE_MAJOR_VERSION} manualmente si experimentas problemas."
    fi
  else
    echo "Error: Node.js no se encuentra. Por favor, instálalo manualmente (v${NODE_MAJOR_VERSION} recomendada)."
    exit 1
  fi
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

# --- Inicio del Script Principal ---
echo ">>> Iniciando la actualización de la aplicación..."

# --- Paso 1: Verificar Prerrequisitos ---
echo "--- Paso 1: Verificando prerrequisitos (git, curl, Node.js, npm)... ---"
check_command "git"
check_command "curl"
setup_nodejs_check # Verifica Node.js y npm

# --- Paso 2: Actualizar Repositorio (asumiendo que ya estamos en el directorio del proyecto) ---
echo "--- Paso 2: Actualizando el repositorio (git pull)... ---"
# Asegurarse de que estamos en un repositorio git
if [ ! -d ".git" ]; then
  echo "Error: No es un repositorio Git. Por favor, ejecuta este script desde la raíz del proyecto."
  exit 1
fi
git pull origin main
echo "Repositorio actualizado correctamente."

# --- Paso 3: Verificar archivo .env.local ---
echo "--- Paso 3: Verificando archivo .env.local ---"
if [ ! -f ".env.local" ]; then
  echo "Error: El archivo .env.local no se encuentra en la raíz del proyecto."
  echo "Por favor, créalo con las variables de entorno necesarias antes de ejecutar la actualización."
  exit 1
fi
echo "Archivo .env.local encontrado."

# --- Paso 4: Instalar Dependencias ---
echo "--- Paso 4: Instalando dependencias con npm... ---"
npm install

# --- Paso 5: Construir la Aplicación Next.js ---
echo "--- Paso 5: Construyendo la aplicación Next.js para producción... ---"
npm run build

# --- Paso 6: Configurar y Usar PM2 ---
echo "--- Paso 6: Configurando y arrancando la aplicación con PM2... ---"
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

# --- Paso 7: Configurar Tareas CRON ---
setup_crontab

# --- Fin del Script ---
echo ""
echo ">>> ¡Actualización completada!"
echo ""
echo "Tu aplicación ahora está corriendo bajo PM2."
echo "Puedes ver el estado de los procesos con el comando: pm2 list"
echo "Puedes ver los logs en tiempo real con: pm2 logs"
echo ""
echo "NOTA: Para que tu aplicación sea accesible desde internet en el puerto 80 (HTTP) o 443 (HTTPS),"
echo "normalmente configurarías un servidor web como Nginx o Apache como un 'reverse proxy'."