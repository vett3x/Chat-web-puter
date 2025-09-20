#!/bin/bash

# --- Configuración ---
REPO_URL="https://github.com/vett3x/Chat-web-puter" # URL del repositorio
# Extraer el nombre del proyecto de la URL del repositorio
PROJECT_NAME=$(basename "$REPO_URL" .git)
PROJECT_DIR="$(pwd)/$PROJECT_NAME"

# --- Comprobación de prerrequisitos ---
echo "Comprobando prerrequisitos..."
command -v git >/dev/null 2>&1 || { echo >&2 "Git no está instalado. Por favor, instala Git."; exit 1; }
command -v node >/dev/null 2>&1 || { echo >&2 "Node.js no está instalado. Por favor, instala Node.js."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo >&2 "npm no está instalado. Por favor, instala npm."; exit 1; }
command -v pm2 >/dev/null 2>&1 || { echo >&2 "PM2 no está instalado. Instalando PM2 globalmente..."; npm install -g pm2; }
command -v ts-node >/dev/null 2>&1 || { echo >&2 "ts-node no está instalado. Instalando ts-node globalmente..."; npm install -g ts-node; }

# --- Clonar o actualizar el repositorio ---
if [ -d "$PROJECT_DIR" ]; then
  echo "El directorio del proyecto '$PROJECT_DIR' ya existe."
  if [ -d "$PROJECT_DIR/.git" ]; then
    echo "Es un repositorio Git. Obteniendo los últimos cambios y reseteando..."
    cd "$PROJECT_DIR" || { echo "Error al cambiar al directorio $PROJECT_DIR"; exit 1; }
    git fetch origin main # Asumiendo que tu rama principal es 'main'
    git reset --hard origin/main
    if [ $? -ne 0 ]; then
      echo "Error al actualizar el repositorio. Por favor, revisa los permisos o el estado de Git."
      exit 1
    fi
  else
    echo "FATAL: El directorio '$PROJECT_DIR' existe pero NO es un repositorio Git."
    echo "Por favor, mueve o elimina el directorio existente para poder clonar el repositorio."
    exit 1
  fi
else
  echo "El directorio del proyecto '$PROJECT_DIR' no existe. Clonando repositorio..."
  git clone "$REPO_URL" "$PROJECT_DIR"
  if [ $? -ne 0 ]; then
    echo "Error al clonar el repositorio. Por favor, revisa la URL o los permisos."
    exit 1
  fi
  cd "$PROJECT_DIR" || { echo "Error al cambiar al directorio $PROJECT_DIR"; exit 1; }
fi

# --- Crear .env.local si no existe (dentro del PROJECT_DIR) ---
if [ ! -f ".env.local" ]; then
  echo "Creando archivo .env.local con placeholders. Por favor, edítalo con tus credenciales reales."
  cat << EOF > .env.local
# Variables de entorno para Supabase
# Reemplaza con tus credenciales de Supabase
NEXT_PUBLIC_SUPABASE_URL="https://juxrggowingqlchwfuct.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1eHJnZ293aW5ncWxjaHdmdWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNDY4OTYsImV4cCI6MjA3MzcyMjg5Nn0.Bf05aFnLW_YCAZdCZC2Kgqtf7is9WcORdDagC2Nq0ec"
SUPABASE_SERVICE_ROLE_KEY="TU_SERVICE_ROLE_KEY_SUPABASE" # ¡IMPORTANTE! Esta clave debe ser secreta y no debe exponerse en el frontend.

# Configuración para que el frontend (desplegado en Proxmox) se conecte al WebSocket (también en Proxmox)
# Si el frontend y el WebSocket están en la misma máquina, puedes usar 'localhost' para NEXT_PUBLIC_WEBSOCKET_HOST.
# Si el frontend se accede desde otra máquina y el WebSocket está en Proxmox, usa la IP pública o el hostname de Proxmox.
NEXT_PUBLIC_WEBSOCKET_HOST="localhost" # O la IP de tu servidor Proxmox (ej. 10.10.10.200)
NEXT_PUBLIC_WEBSOCKET_PORT="3001"
EOF
  echo "Archivo .env.local creado. ¡Recuerda editarlo con tus valores reales!"
else
  echo "El archivo .env.local ya existe. No se ha modificado."
fi

# --- Detener y eliminar procesos existentes de PM2 ---
echo "Deteniendo y eliminando procesos PM2 existentes para la aplicación y el servidor websocket..."
pm2 stop chat-web-app || true
pm2 delete chat-web-app || true
pm2 stop websocket-server || true
pm2 delete websocket-server || true
# Añadido para eliminar la aplicación anterior
pm2 stop claude-chat-app || true
pm2 delete claude-chat-app || true

# --- Instalar/actualizar dependencias ---
echo "Instalando/actualizando dependencias npm..."
npm install

# --- Construir la aplicación Next.js ---
echo "Construyendo la aplicación Next.js..."
npm run build

# --- Iniciar la aplicación Next.js con PM2 ---
echo "Iniciando la aplicación Next.js con PM2..."
# Asegúrate de que el archivo .env.local esté en el directorio del proyecto
pm2 start npm --name "chat-web-app" -- start

# --- Iniciar el servidor WebSocket con PM2 ---
echo "Iniciando el servidor WebSocket con PM2..."
# El script websocket.ts ya define su puerto (3001) y carga .env.local
pm2 start ts-node --name "websocket-server" -- server/websocket.ts

echo "Script de despliegue finalizado."
echo "Puedes verificar el estado de tus aplicaciones con 'pm2 list'."
echo "Para ver los logs de la aplicación Next.js: 'pm2 logs chat-web-app'"
echo "Para ver los logs del servidor WebSocket: 'pm2 logs websocket-server'"
echo "Para guardar la configuración de PM2 y que se inicie al reiniciar el servidor: 'pm2 save --force'"
echo "Para configurar PM2 para que se inicie al arrancar el sistema: 'pm2 startup'"