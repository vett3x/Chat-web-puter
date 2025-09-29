#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

# --- Configuration ---
# Check if a password file path is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <path_to_password_file>"
  exit 1
fi

PASS_FILE=$1
if [ ! -f "$PASS_FILE" ]; then
    echo "ERROR: Password file not found at $PASS_FILE"
    exit 1
fi

# Read the password from the file and then immediately delete the file
DB_PASSWORD=$(cat "$PASS_FILE")
rm -f "$PASS_FILE"

APP_DB_USER="app_user"
APP_DB_NAME="app_db"

echo "--- Starting PostgreSQL Installation and Configuration ---"

# --- Installation ---
apt-get update -y
apt-get install -y postgresql postgresql-client
echo "--- PostgreSQL Installed ---"

# --- Configuration for Remote Access ---
PG_CONF=$(find /etc/postgresql -name "postgresql.conf" | head -n 1)
PG_HBA=$(find /etc/postgresql -name "pg_hba.conf" | head -n 1)

if [ -z "$PG_CONF" ] || [ -z "$PG_HBA" ]; then
    echo "ERROR: PostgreSQL configuration files not found!"
    exit 1
fi

echo "--- Configuring postgresql.conf to listen on all addresses ---"
if ! grep -q "^listen_addresses = '\\*'" "$PG_CONF"; then
    sed -i "s/.*listen_addresses.*/listen_addresses = '*'/" "$PG_CONF"
fi

echo "--- Configuring pg_hba.conf for remote password authentication ---"
if ! grep -q "host    all             all             0.0.0.0/0               md5" "$PG_HBA"; then
    echo "host    all             all             0.0.0.0/0               md5" >> "$PG_HBA"
fi

echo "--- Restarting PostgreSQL service to apply changes ---"
systemctl restart postgresql
sleep 5 # Wait for the service to be ready

# --- Database and User Setup (Idempotent) ---
echo "--- Setting up dedicated database and user ---"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<-EOSQL
    -- Set password for the default superuser
    ALTER USER postgres WITH PASSWORD '$DB_PASSWORD';

    -- Create a dedicated user for the application if it doesn't exist
    DO \$\$
    BEGIN
       IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$APP_DB_USER') THEN
          CREATE ROLE $APP_DB_USER WITH LOGIN PASSWORD '$DB_PASSWORD';
       END IF;
    END
    \$\$;

    -- Create a dedicated database for the application if it doesn't exist
    SELECT 'CREATE DATABASE $APP_DB_NAME'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$APP_DB_NAME')\gexec

    -- Grant all privileges on the new database to the new user
    GRANT ALL PRIVILEGES ON DATABASE $APP_DB_NAME TO $APP_DB_USER;
EOSQL

echo "--- PostgreSQL Provisioning Complete ---"
echo "Server is ready. Connect using user '$APP_DB_USER' on database '$APP_DB_NAME'."