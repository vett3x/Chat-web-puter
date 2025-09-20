#!/bin/bash

# --- Configuración ---
# URL del repositorio Git.
REPO_URL="https://github.com/vett3x/Chat-web-puter" 
# Directorio donde se clonará y desplegará el proyecto.
PROJECT_DIR="/home/Web-chat" 

# --- 1. Clonar o Actualizar el Repositorio ---
echo "--- Gestionando el repositorio Git ---"
if [ -d "$PROJECT_DIR" ]; then
  echo "El directorio del proyecto ya existe. Actualizando desde Git..."
  cd "$PROJECT_DIR" || exit
  git pull origin main # O la rama que uses, ej: master
else
  echo "El directorio del proyecto no existe. Clonando desde Git..."
  git clone "$REPO_URL" "$PROJECT_DIR" || { echo "ERROR: Falló la clonación del repositorio."; exit 1; }
  cd "$PROJECT_DIR" || exit
fi

# --- 2. Node.js Version Check and Auto-Update ---
echo "--- Verificando la versión de Node.js ---"
load_nvm() {
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
}
load_nvm

if ! command -v nvm &> /dev/null; then
  echo "nvm no encontrado. Instalando nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  load_nvm
fi

if ! command -v nvm &> /dev/null; then
    echo "ERROR: nvm no se pudo instalar o cargar. Por favor, instálalo manualmente."
    exit 1
fi

CURRENT_NODE_VERSION=$(node -v 2>/dev/null || echo "v0.0.0")
NODE_MAJOR_VERSION=$(echo "$CURRENT_NODE_VERSION" | cut -d '.' -f 1 | sed 's/v//')
REQUIRED_NODE_MAJOR=22

if [ "$NODE_MAJOR_VERSION" -lt "$REQUIRED_NODE_MAJOR" ]; then
  echo "Node.js v$NODE_MAJOR_VERSION detectada. Se requiere v$REQUIRED_NODE_MAJOR+. Instalando..."
  nvm install "$REQUIRED_NODE_MAJOR" && nvm use "$REQUIRED_NODE_MAJOR" && nvm alias default "$REQUIRED_NODE_MAJOR"
  echo "Node.js actualizado a $(node -v)."
else
  echo "Node.js v$NODE_MAJOR_VERSION es compatible."
  nvm use "$NODE_MAJOR_VERSION"
fi

# --- 3. Crear archivo de entorno ---
echo "--- Creando archivo de entorno .env.local ---"
cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=https://juxrggowingqlchwfuct.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1eHJnZ293aW5ncWxjaHdmdWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNDY4OTYsImV4cCI6MjA3MzcyMjg5Nn0.Bf05aFnLW_YCAZdCZC2Kgqtf7is9WcORdDagC2Nq0ec
# IMPORTANTE: Reemplaza el siguiente valor con tu clave de servicio de Supabase.
# La puedes encontrar en tu panel de Supabase -> Project Settings -> API -> Service role key.
SUPABASE_SERVICE_ROLE_KEY=TU_CLAVE_DE_SERVICIO_AQUI
EOF

# --- 4. Instalar, Construir y Desplegar ---
echo "--- Desplegando la aplicación ---"

# Detener y eliminar la aplicación PM2 existente
echo "Deteniendo y eliminando la aplicación PM2 existente..."
pm2 delete chat-web-app &>/dev/null || true
pm2 delete websocket-server &>/dev/null || true

# Instalar dependencias
echo "Instalando dependencias de npm..."
npm install || { echo "ERROR: 'npm install' falló."; exit 1; }

# Construir la aplicación Next.js
echo "Construyendo la aplicación Next.js..."
npm run build || { echo "ERROR: 'npm run build' falló."; exit 1; }

# Iniciar la aplicación Next.js con PM2
echo "Iniciando la aplicación Next.js con PM2..."
pm2 start npm --name "chat-web-app" -- start

# Iniciar el servidor WebSocket con PM2
echo "Iniciando el servidor WebSocket con PM2..."
pm2 start ts-node --name "websocket-server" -- server/websocket.ts

echo "--- Despliegue completado ---"
pm2 list