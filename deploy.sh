#!/bin/bash

# --- Node.js Version Check ---
echo "Verificando la versión de Node.js..."
NODE_MAJOR_VERSION=$(node -v | cut -d '.' -f 1 | sed 's/v//')

if [ "$NODE_MAJOR_VERSION" -lt 20 ]; then
  echo "ERROR: Node.js versión $NODE_MAJOR_VERSION detectada. Se requiere Node.js versión 20 o superior."
  echo "Por favor, actualiza Node.js en tu sistema. Puedes usar nvm (Node Version Manager) para esto:"
  echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
  echo "  nvm install 20"
  echo "  nvm use 20"
  exit 1
fi
echo "Node.js versión $NODE_MAJOR_VERSION es compatible."
# --- End Node.js Version Check ---

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