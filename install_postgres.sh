#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

# Check if a password is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <postgres_password>"
  exit 1
fi

DB_PASSWORD=$1

echo "--- Starting PostgreSQL Installation and Configuration ---"

# Update package lists
apt-get update -y

# Install PostgreSQL and its client
apt-get install -y postgresql postgresql-client

echo "--- PostgreSQL Installed ---"

# Find the main postgresql.conf file path
PG_CONF=$(find /etc/postgresql -name "postgresql.conf" | head -n 1)
if [ -z "$PG_CONF" ]; then
    echo "ERROR: postgresql.conf not found!"
    exit 1
fi
echo "Found postgresql.conf at $PG_CONF"

# Find the main pg_hba.conf file path
PG_HBA=$(find /etc/postgresql -name "pg_hba.conf" | head -n 1)
if [ -z "$PG_HBA" ]; then
    echo "ERROR: pg_hba.conf not found!"
    exit 1
fi
echo "Found pg_hba.conf at $PG_HBA"

# Configure PostgreSQL to listen on all addresses
echo "--- Configuring postgresql.conf to listen on all addresses ---"
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONF"
# Also uncomment if it's commented out without a value
sed -i "s/listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONF"

# Allow password authentication for all IPv4 remote connections
echo "--- Configuring pg_hba.conf for remote access ---"
# This line allows any user from any IP to connect to any database with a password.
# For better security, you might want to restrict the IP range.
echo "host    all             all             0.0.0.0/0               md5" >> "$PG_HBA"

# Restart PostgreSQL to apply changes
echo "--- Restarting PostgreSQL service ---"
systemctl restart postgresql

# Wait a moment for the service to restart
sleep 5

# Change the password for the postgres user
echo "--- Setting password for 'postgres' user ---"
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '$DB_PASSWORD';"

echo "--- PostgreSQL Provisioning Complete ---"
echo "Server is ready to accept remote connections."