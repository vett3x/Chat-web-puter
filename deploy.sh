#!/bin/bash

# --- Configuración ---
# IMPORTANTE: Cambia esto a la ruta ABSOLUTA de tu directorio de proyecto en Proxmox
PROJECT_DIR="/var/www/Chat-web-puter" 
REPO_URL="https://github.com/vett3x/Chat-web-puter"

# --- Comprobación de prerrequisitos ---
echo "Comprobando prerrequisitos..."
command -v git >/dev/null 2>&1 || { echo >&2 "Git no está instalado. Por favor, instala Git."; exit 1; }
command -v node >/dev/null 2>&1 || { echo >&2 "Node.js no está instalado. Por favor, instala Node.js."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo >&2 "npm no está instalado. Por favor, instala npm."; exit 1; }
command -v pm2 >/dev/null 2>&1 || { echo >&2 "PM2 no está instalado. Instalando PM2 globalmente..."; npm install -g pm2; }
command -v ts-node >/dev/null 2>&1 || { echo >&2 "ts-node no está instalado. Instalando ts-node globalmente..."; npm install -g ts-node; }


# --- Navegar o clonar el directorio del proyecto ---
if [ ! -d "$PROJECT_DIR" ]; then
  echo "El directorio del proyecto $PROJECT_DIR no existe. Clonando repositorio..."
  git clone "$REPO_URL" "$PROJECT_DIR"
  cd "$PROJECT_DIR" || { echo "Error al cambiar al directorio $PROJECT_DIR"; exit 1; }
else
  echo "Navegando al directorio del proyecto: $PROJECT_DIR"
  cd "$PROJECT_DIR" || { echo "Error al cambiar al directorio $PROJECT_DIR"; exit 1; }
  echo "Obteniendo los últimos cambios de Git..."
  git pull origin main # Asumiendo que tu rama principal es 'main'
fi

# --- Detener y eliminar procesos existentes de PM2 ---
echo "Deteniendo y eliminando procesos PM2 existentes para la aplicación y el servidor websocket..."
pm2 stop chat-web-app || true
pm2 delete chat-web-app || true
pm2 stop websocket-server || true
pm2 delete websocket-server || true

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