#!/bin/bash

# --- Node.js Version Check and Auto-Update ---
echo "Verificando la versión de Node.js..."

# Función para cargar nvm en el shell actual
load_nvm() {
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
  [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion" # This loads nvm bash_completion
}

# 1. Verificar si nvm está instalado. Si no, instalarlo.
if [ ! -d "$HOME/.nvm" ]; then
  echo "nvm no encontrado. Instalando nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  load_nvm # Cargar nvm después de la instalación
else
  load_nvm # Cargar nvm si ya está instalado
fi

# 2. Verificar si nvm se cargó correctamente
if ! command -v nvm &> /dev/null; then
    echo "ERROR: nvm no se pudo instalar o cargar correctamente. Por favor, verifica tu instalación de nvm y vuelve a intentarlo."
    exit 1
fi

# 3. Obtener la versión actual de Node.js (o una por defecto si no está instalada)
CURRENT_NODE_VERSION=$(node -v 2>/dev/null || echo "v0.0.0")
NODE_MAJOR_VERSION=$(echo "$CURRENT_NODE_VERSION" | cut -d '.' -f 1 | sed 's/v//')

REQUIRED_NODE_MAJOR=22 # Versión mínima requerida, actualizada a Node.js 22

if [ "$NODE_MAJOR_VERSION" -lt "$REQUIRED_NODE_MAJOR" ]; then
  echo "Node.js versión $NODE_MAJOR_VERSION detectada. Se requiere Node.js versión $REQUIRED_NODE_MAJOR o superior."
  echo "Instalando y activando Node.js $REQUIRED_NODE_MAJOR usando nvm..."
  nvm install "$REQUIRED_NODE_MAJOR" || { echo "ERROR: Falló la instalación de Node.js $REQUIRED_NODE_MAJOR con nvm."; exit 1; }
  nvm use "$REQUIRED_NODE_MAJOR" || { echo "ERROR: Falló la activación de Node.js $REQUIRED_NODE_MAJOR con nvm."; exit 1; }
  nvm alias default "$REQUIRED_NODE_MAJOR" || { echo "ADVERTENCIA: Falló al establecer Node.js $REQUIRED_NODE_MAJOR como predeterminado."; }
  echo "Node.js actualizado a $(node -v)."
else
  echo "Node.js versión $NODE_MAJOR_VERSION es compatible."
  # Asegurarse de que la versión compatible esté en uso para la sesión actual
  nvm use "$NODE_MAJOR_VERSION" || { echo "ERROR: Falló la activación de Node.js $NODE_MAJOR_VERSION con nvm."; exit 1; }
fi
# --- Fin de la verificación y auto-actualización de Node.js ---

# Detener y eliminar la aplicación PM2 existente si está corriendo
echo "Deteniendo y eliminando la aplicación PM2 existente (si existe)..."
pm2 delete chat-web-app &>/dev/null || true
pm2 delete websocket-server &>/dev/null || true

# Instalar dependencias
echo "Instalando dependencias de npm..."
npm install

# Construir la aplicación Next.js
echo "Construyendo la aplicación Next.js..."
npm run build

# Iniciar la aplicación Next.js con PM2
echo "Iniciando la aplicación Next.js con PM2..."
pm2 start npm --name "chat-web-app" -- start

# Iniciar el servidor WebSocket con PM2
echo "Iniciando el servidor WebSocket con PM2..."
pm2 start ts-node --name "websocket-server" -- server/websocket.ts

echo "Despliegue completado. Puedes verificar el estado con 'pm2 list'."