#!/bin/bash
#
# Script para instalar y configurar MinIO como un servicio en Ubuntu Server.
#
# - Descarga el binario de MinIO.
# - Crea un usuario de sistema dedicado para MinIO.
# - Crea un archivo de servicio systemd para autoinicio.
# - Configura el firewall UFW.
# - Genera una contraseña segura y la muestra al final.
#
set -e
set -o pipefail

# --- CONFIGURACIÓN (Puedes modificar estas variables) ---

# Directorio donde MinIO almacenará los datos.
# Asegúrate de que este directorio exista o de que el script tenga permisos para crearlo.
# Si tienes un disco duro dedicado montado, cambia esta ruta a tu punto de montaje (ej: /mnt/hdd1/minio/data).
MINIO_DATA_DIR="/mnt/minio/data"

# Usuario y contraseña para el acceso a la consola de MinIO.
# ¡IMPORTANTE! Cambia el usuario y, si quieres, la contraseña.
# Si dejas la contraseña como está, se generará una aleatoria y segura.
MINIO_ROOT_USER="minioadmin"
MINIO_ROOT_PASSWORD=$(openssl rand -base64 16) # O reemplaza esto con tu propia contraseña entre comillas: "TuContraseñaSegura"

# Puertos para la API y la consola web.
MINIO_API_PORT="9000"
MINIO_CONSOLE_PORT="9001"

# --- FIN DE LA CONFIGURACIÓN ---

echo ">>> Iniciando la instalación de MinIO..."

# 1. Actualizar paquetes e instalar dependencias
echo ">>> [1/6] Actualizando paquetes e instalando dependencias (wget, ufw)..."
sudo apt-get update
sudo apt-get install -y wget ufw

# 2. Crear usuario y directorios para MinIO
echo ">>> [2/6] Creando usuario de sistema 'minio-user' y directorio de datos..."
# Crear un usuario de sistema sin capacidad de login
if ! id "minio-user" &>/dev/null; then
    sudo useradd -r minio-user -s /sbin/nologin
fi
# Crear el directorio de datos y asignar permisos
sudo mkdir -p ${MINIO_DATA_DIR}
sudo chown minio-user:minio-user ${MINIO_DATA_DIR}

# 3. Descargar e instalar el binario de MinIO
echo ">>> [3/6] Descargando el binario de MinIO..."
sudo wget -O /usr/local/bin/minio https://dl.min.io/server/minio/release/linux-amd64/minio
sudo chmod +x /usr/local/bin/minio

# 4. Crear el archivo de servicio systemd
echo ">>> [4/6] Creando el archivo de servicio systemd para MinIO..."
sudo tee /etc/systemd/system/minio.service > /dev/null <<EOF
[Unit]
Description=MinIO Object Storage
Documentation=https://docs.min.io
Wants=network-online.target
After=network-online.target

[Service]
User=minio-user
Group=minio-user
ProtectSystem=full
ProtectHome=true
PrivateTmp=true
NoNewPrivileges=true

# Variables de entorno para las credenciales
Environment="MINIO_ROOT_USER=${MINIO_ROOT_USER}"
Environment="MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}"

# Comando de inicio
ExecStart=/usr/local/bin/minio server --console-address ":${MINIO_CONSOLE_PORT}" --address ":${MINIO_API_PORT}" ${MINIO_DATA_DIR}

# Reiniciar siempre en caso de fallo
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# 5. Habilitar y arrancar el servicio MinIO
echo ">>> [5/6] Habilitando y arrancando el servicio MinIO..."
sudo systemctl daemon-reload
sudo systemctl enable minio
sudo systemctl start minio

# 6. Configurar el firewall
echo ">>> [6/6] Configurando el firewall (UFW)..."
sudo ufw allow ${MINIO_API_PORT}/tcp
sudo ufw allow ${MINIO_CONSOLE_PORT}/tcp
# Habilitar UFW si no está activo (la opción --force evita la pregunta interactiva)
sudo ufw --force enable

# Obtener la IP del servidor para mostrarla al usuario
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "-------------------------------------------------------------------"
echo "¡Instalación de MinIO completada!"
echo ""
echo "Puedes acceder a la consola web en:"
echo "   http://${SERVER_IP}:${MINIO_CONSOLE_PORT}"
echo ""
echo "Credenciales de acceso:"
echo "   Usuario:    ${MINIO_ROOT_USER}"
echo "   Contraseña: ${MINIO_ROOT_PASSWORD}"
echo ""
echo "El puerto de la API para clientes S3 es: ${MINIO_API_PORT}"
echo "-------------------------------------------------------------------"
echo ""

# Comprobar el estado del servicio para confirmar que está corriendo
sudo systemctl status minio --no-pager