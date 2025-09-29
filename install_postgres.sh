#!/bin/bash
#
# Script para instalar y configurar PostgreSQL en Ubuntu Server
# para permitir conexiones remotas seguras.
#

# --- CONFIGURACIÓN ---
# ⚠️ ¡IMPORTANTE! Cambia esta contraseña por una segura.
# Esta será la contraseña para el usuario 'postgres' de la base de datos.
DB_PASSWORD="TuContraseñaSuperSeguraAqui"

# Red desde la que se permitirán las conexiones.
# 10.10.10.0/24 permite cualquier dispositivo en tu red 10.10.10.x
ALLOWED_NETWORK="10.10.10.0/24"

# --- NO EDITAR DEBAJO DE ESTA LÍNEA ---

# Salir inmediatamente si un comando falla
set -e

echo "--- [Paso 1/7] Actualizando paquetes del sistema... ---"
sudo apt-get update -y > /dev/null
sudo apt-get upgrade -y > /dev/null
echo "Sistema actualizado."

echo "--- [Paso 2/7] Instalando PostgreSQL... ---"
sudo apt-get install postgresql postgresql-contrib -y > /dev/null
echo "PostgreSQL instalado."

echo "--- [Paso 3/7] Localizando archivos de configuración... ---"
# Encuentra la ruta de los archivos de configuración dinámicamente
PG_CONF=$(find /etc/postgresql -name "postgresql.conf" -print -quit)
PG_HBA_CONF=$(find /etc/postgresql -name "pg_hba.conf" -print -quit)

if [ -z "$PG_CONF" ] || [ -z "$PG_HBA_CONF" ]; then
    echo "ERROR: No se pudieron encontrar los archivos de configuración de PostgreSQL."
    exit 1
fi
echo "postgresql.conf encontrado en: $PG_CONF"
echo "pg_hba.conf encontrado en: $PG_HBA_CONF"

echo "--- [Paso 4/7] Configurando 'postgresql.conf' para conexiones remotas... ---"
# Permitir que PostgreSQL escuche en todas las interfaces de red
sudo sed -i "s/^#*listen_addresses = .*/listen_addresses = '*'/" "$PG_CONF"
# Establecer el método de encriptación de contraseñas moderno y seguro
sudo sed -i "s/^#*password_encryption = .*/password_encryption = 'scram-sha-256'/" "$PG_CONF"
echo "'postgresql.conf' configurado."

echo "--- [Paso 5/7] Configurando 'pg_hba.conf' para permitir acceso desde la red... ---"
# Añadir una regla para permitir conexiones desde la red local con el método de autenticación seguro
echo "# Regla añadida por el script de Dyad para permitir conexiones remotas seguras" | sudo tee -a "$PG_HBA_CONF" > /dev/null
echo "host    all             all             $ALLOWED_NETWORK          scram-sha-256" | sudo tee -a "$PG_HBA_CONF" > /dev/null
echo "'pg_hba.conf' configurado."

echo "--- [Paso 6/7] Reiniciando el servicio de PostgreSQL... ---"
sudo systemctl restart postgresql
echo "Servicio reiniciado."

echo "--- [Paso 7/7] Estableciendo la contraseña para el usuario 'postgres'... ---"
# Cambiar la contraseña del usuario 'postgres' de la base de datos de forma no interactiva
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '$DB_PASSWORD';"
echo "Contraseña establecida."

echo ""
echo "✅ ¡LISTO! Instalación y configuración completadas."
echo "--------------------------------------------------"
echo "Puedes conectarte a la base de datos usando:"
echo "Host/IP:      10.10.10.210"
echo "Puerto:       5432"
echo "Usuario:      postgres"
echo "Base de Datos: postgres"
echo "Contraseña:   La que estableciste en la variable DB_PASSWORD del script."
echo "--------------------------------------------------"