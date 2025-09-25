#!/bin/bash

# Script para desplegar la aplicaci  n Chat-web-puter desde GitHub en un servidor Linux.
#
# Prerrequisitos:
# - Un servidor Linux (probado en Ubuntu 22.04).
# - Git instalado (`sudo apt install git`).
# - Node.js (v22 ser   instalado por el script) y npm.
#
# Uso:
# 1. Guarda este script como `install.sh`.
# 2. Dale permisos de ejecuci  n: `chmod +x install.sh`.
# 3. Ejec  talo: `./install.sh`.

set -e # Salir inmediatamente si un comando falla.

# --- Variables ---
REPO_URL="https://github.com/vett3x/Chat-web-puter.git"
PROJECT_DIR="Chat-web-puter"
NEXT_APP_NAME="chat-app-next"
WS_APP_NAME="chat-app-ws"

# --- Funciones de Ayuda ---
function check_command() {
  if ! command -v $1 &> /dev/null; then
    echo "Error: El comando '$1' no se encuentra. Por favor, inst  lalo."
    exit 1
  fi
}

function setup_nodejs() {
  echo " ^=^t^n Configurando Node.js v22..."
  # Comprueba si node est   instalado y si es la versi  n 22.
  if command -v node &> /dev/null && [[ $(node -v) == v22.* ]]; then
    echo " ^z   ^o Node.js v22 ya est   instalado."
    return
  fi

  echo "   - Instalando dependencias para el repositorio de NodeSource (curl, gnupg)..."
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg

  echo "   - A  adiendo la clave GPG de NodeSource..."
  sudo mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg

  echo "   - A  adiendo el repositorio de Node.js v22..."
  NODE_MAJOR=22
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list

  echo "   - Actualizando la lista de paquetes e instalando Node.js v22..."
  sudo apt-get update
  sudo apt-get install nodejs -y

  echo " ^=^r  Node.js v22 instalado correctamente. Versi  n: $(node -v)"
}

function setup_pm2() {
  if ! command -v pm2 &> /dev/null; then
    echo "PM2 no est   instalado. Instalando globalmente con npm..."
    sudo npm install pm2 -g
  fi
}

# --- Inicio del Script ---
echo " ^=^z^` Iniciando el despliegue de la aplicaci  n..."

# 1. Configurar e instalar Node.js v22
setup_nodejs

# 2. Verificar prerrequisitos restantes
echo " ^=^t^n Verificando prerrequisitos (git, npm)..."
check_command "git"
check_command "npm"

# 3. Clonar el repositorio
if [ -d "$PROJECT_DIR" ]; then
  echo " ^z   ^o El directorio '$PROJECT_DIR' ya existe. Omitiendo clonaci  n."
else
  echo " ^=^s^b Clonando el repositorio desde GitHub..."
  git clone "$REPO_URL"
fi

cd "$PROJECT_DIR"
echo " ^|^e Navegando al directorio del proyecto: $(pwd)"

# 4. Configuraci  n de variables de entorno (Paso Manual)
echo ""
echo " ^=^{^q ACCI ^sN REQUERIDA: Configuraci  n del entorno."
echo "Necesitas crear un archivo '.env.local' con las claves de Supabase."
echo "Copia y pega el siguiente contenido en un nuevo archivo llamado '.env.local':"
echo ""
echo "----------------------------------------------------------------"
cat << EOF
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://juxrggowingqlchwfuct.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1eHJnZ293aW5ncWxjaHdmdWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNDY4OTYsImV4cCI6MjA3MzcyMjg5Nn0.Bf05aFnLW_YCAZdCZC2Kgqtf7is9WcORdDagC2Nq0ec"

# La clave de servicio es un secreto y debe manejarse con cuidado.
# Aseg  rate de que este archivo .env.local no se suba a tu repositorio.
SUPABASE_SERVICE_ROLE_KEY="tu_supabase_service_role_key_aqui"

# Puerto para el servidor de WebSockets
WEBSOCKET_PORT=3001
EOF
echo "----------------------------------------------------------------"
echo ""
echo "IMPORTANTE: Reemplaza 'tu_supabase_service_role_key_aqui' con tu clave real de Supabase."
read -p "Una vez que hayas creado y guardado el archivo '.env.local', presiona [Enter] para continuar..."

if [ ! -f ".env.local" ]; then
    echo " ^}^l Error: El archivo .env.local no fue encontrado. Abortando."
    exit 1
fi

# 5. Instalar dependencias
echo " ^=^s  Instalando dependencias con npm..."
npm install

# 6. Construir la aplicaci  n Next.js para producci  n
echo " ^=^o^w  ^o Construyendo la aplicaci  n Next.js..."
npm run build

# 7. Compilar el servidor de WebSockets
echo " ^z^y  ^o Compilando el servidor de WebSockets..."
# La compilaci  n de Next.js deber  a manejar los archivos .ts, pero por si acaso, usamos ts-node.
# Para producci  n real, ser  a mejor compilarlo a .js con `tsc`.
# Por ahora, PM2 puede ejecutarlo directamente con ts-node.

# 8. Configurar y usar PM2 para ejecutar la aplicaci  n
echo " ^=^z^` Configurando y arrancando la aplicaci  n con PM2..."
setup_pm2

# Detener procesos antiguos si existen
pm2 delete "$NEXT_APP_NAME" || true
pm2 delete "$WS_APP_NAME" || true

# Iniciar la aplicaci  n Next.js
echo "   - Iniciando servidor Next.js..."
pm2 start npm --name "$NEXT_APP_NAME" -- start

# Iniciar el servidor de WebSockets
echo "   - Iniciando servidor de WebSockets..."
pm2 start "ts-node" --name "$WS_APP_NAME" -- server/websocket.ts

# Guardar la lista de procesos de PM2 para que se reinicien con el servidor
pm2 save
echo " ^=^r  Lista de procesos de PM2 guardada."

# --- Fin del Script ---
echo ""
echo " ^|^e   Despliegue completado!"
echo ""
echo "Tu aplicaci  n ahora est   corriendo bajo PM2."
echo "Puedes ver el estado de los procesos con el comando: pm2 list"
echo "Puedes ver los logs en tiempo real con: pm2 logs"
echo ""
echo "NOTA: Para que tu aplicaci  n sea accesible desde internet en el puerto 80 (HTTP) o 443 (HTTPS),"
echo "normalmente configurar  as un servidor web como Nginx o Apache como un 'reverse proxy'."