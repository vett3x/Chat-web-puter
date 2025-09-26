#!/bin/bash

# Salir inmediatamente si un comando falla.
set -e

echo "--- Iniciando el proceso de despliegue robusto ---"

# Definir el nombre del directorio del proyecto
PROJECT_DIR="Chat-web-puter"
# Navegar al directorio del script para asegurar que las rutas relativas funcionen
cd "$(dirname "$0")"
# Ruta al directorio padre
PARENT_DIR=$(dirname "$(pwd)")
# Ruta temporal para el archivo de entorno
TEMP_ENV_PATH="$PARENT_DIR/.env.local.bak"

# 1. Respaldar .env.local si existe
if [ -f ".env.local" ]; then
  echo "Respaldando .env.local..."
  mv .env.local "$TEMP_ENV_PATH"
else
  echo ".env.local no encontrado, omitiendo respaldo."
fi

# 2. Ir al directorio padre y eliminar la carpeta antigua del proyecto
echo "Navegando al directorio padre..."
cd ..

echo "Eliminando el directorio antiguo del proyecto: $PROJECT_DIR..."
rm -rf "$PROJECT_DIR"

# 3. Clonar una copia fresca del repositorio
echo "Clonando una copia nueva del repositorio..."
git clone https://github.com/vett3x/Chat-web-puter.git

# 4. Entrar en el nuevo directorio del proyecto
cd "$PROJECT_DIR"
echo "Se ha entrado en el nuevo directorio del proyecto: $(pwd)"

# 5. Restaurar .env.local si fue respaldado
if [ -f "$TEMP_ENV_PATH" ]; then
  echo "Restaurando .env.local..."
  mv "$TEMP_ENV_PATH" .env.local
else
  echo "No hay respaldo de .env.local para restaurar."
fi

# 6. Instalar dependencias
echo "Instalando dependencias de npm..."
npm install

# 7. Construir la aplicación
echo "Construyendo la aplicación Next.js..."
npm run build

# 8. Reiniciar la aplicación usando el gestor de procesos (ej. PM2)
# Esta es la forma correcta de reiniciar tu aplicación.
echo "Reiniciando la aplicación..."
# El gestor de procesos (como PM2) debería reiniciar la aplicación automáticamente.
# Si usas PM2, el siguiente comando lo haría:
# pm2 restart all

echo "--- ¡Despliegue completado! La aplicación se reiniciará en breve. ---"