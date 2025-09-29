#!/bin/bash
#
# Script GENERALIZADO para instalar y configurar PostgreSQL en Ubuntu Server
# para permitir conexiones remotas seguras.
# Acepta la contraseña de la base de datos como el primer argumento.
#

# --- NO EDITAR DEBAJO DE ESTA LÍNEA ---

# Salir inmediatamente si un comando falla
set -e

# Validar que se haya proporcionado una contraseña
if [ -z "$1" ]; then
    echo "ERROR: No se proporcionó una contraseña para la base de datos como argumento."
    echo "Uso: sudo ./install_postgres.sh 'su-contraseña-segura'"
    exit 1
fi

DB_PASSWORD="$1"
ALLOWED_NETWORK="0.0.0.0/0" # Permitir desde cualquier IP para máxima flexibilidad

echo "--- [Paso 1/7] Actualizando paquetes del sistema... ---"
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -y > /dev/null
sudo apt-get -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" upgrade > /dev/null
echo "Sistema actualizado."

echo "--- [Paso 2/7] Instalando PostgreSQL... ---"
sudo apt-get install postgresql postgresql-contrib -y > /dev/null
echo "PostgreSQL instalado."

echo "--- [Paso 3/7] Localizando archivos de configuración... ---"
PG_CONF=$(find /etc/postgresql -name "postgresql.conf" -print -quit)
PG_HBA_CONF=$(find /etc/postgresql -name "pg_hba.conf" -print -quit)

if [ -z "$PG_CONF" ] || [ -z "$PG_HBA_CONF" ]; then
    echo "ERROR: No se pudieron encontrar los archivos de configuración de PostgreSQL."
    exit 1
fi
echo "postgresql.conf encontrado en: $PG_CONF"
echo "pg_hba.conf encontrado en: $PG_HBA_CONF"

echo "--- [Paso 4/7] Configurando 'postgresql.conf' para conexiones remotas... ---"
sudo sed -i "s/^#*listen_addresses = .*/listen_addresses = '*'/" "$PG_CONF"
sudo sed -i "s/^#*password_encryption = .*/password_encryption = 'scram-sha-256'/" "$PG_CONF"
echo "'postgresql.conf' configurado."

echo "--- [Paso 5/7] Configurando 'pg_hba.conf' para permitir acceso desde la red... ---"
echo "# Regla añadida por el script de Dyad para permitir conexiones remotas seguras" | sudo tee -a "$PG_HBA_CONF" > /dev/null
echo "host    all             all             $ALLOWED_NETWORK          scram-sha-256" | sudo tee -a "$PG_HBA_CONF" > /dev/null
echo "'pg_hba.conf' configurado."

echo "--- [Paso 6/7] Reiniciando el servicio de PostgreSQL... ---"
sudo systemctl restart postgresql
echo "Servicio reiniciado."

echo "--- [Paso 7/7] Estableciendo la contraseña para el usuario 'postgres'... ---"
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '$DB_PASSWORD';"
echo "Contraseña establecida."

echo ""
echo "✅ ¡LISTO! Instalación y configuración completadas."