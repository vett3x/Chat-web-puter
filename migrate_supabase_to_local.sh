#!/bin/bash

# --- Configuración de Colores para la Consola ---
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Inicio de la Migración de Supabase Cloud a Local ===${NC}"

# --- 1. Obtener Credenciales de Supabase Cloud (usando Session Pooler) ---
echo -e "${YELLOW}Por favor, introduce las credenciales de tu base de datos de Supabase en la NUBE (usando Session Pooler para compatibilidad IPv4):${NC}"
read -p "Host del Session Pooler (ej. aws-1-eu-west-3.pooler.supabase.com): " PGHOST_CLOUD
read -p "Puerto del Session Pooler (por defecto 6543): " PGPORT_CLOUD
PGPORT_CLOUD=${PGPORT_CLOUD:-6543} # Valor por defecto para Session Pooler
read -p "Usuario del Session Pooler (ej. postgres.juxrggowingqlchwfuct): " PGUSER_CLOUD
read -s -p "Contraseña de la base de datos: " PGPASSWORD_CLOUD
echo ""
read -p "Nombre de la base de datos (por defecto postgres): " PGDATABASE_CLOUD
PGDATABASE_CLOUD=${PGDATABASE_CLOUD:-postgres} # Valor por defecto

# --- 2. Configurar Credenciales de Supabase Local ---
echo -e "\n${YELLOW}Configurando credenciales para tu base de datos de Supabase LOCAL:${NC}"
PGHOST_LOCAL="localhost"
PGPORT_LOCAL="54322" # Corregido para usar el puerto mapeado en el host
PGUSER_LOCAL="postgres"
PGPASSWORD_LOCAL="postgres" # Contraseña por defecto de Supabase local
PGDATABASE_LOCAL="postgres" # Base de datos por defecto de Supabase local

echo "Host Local: $PGHOST_LOCAL"
echo "Puerto Local: $PGPORT_LOCAL"
echo "Usuario Local: $PGUSER_LOCAL"
echo "Base de Datos Local: $PGDATABASE_LOCAL"

# --- 3. Definir archivos temporales ---
SCHEMA_FILE="cloud_schema.sql"
DATA_FILE="cloud_data.sql"

# --- 4. Esquemas a Excluir (AHORA SIN 'auth' NI 'storage') ---
EXCLUDE_SCHEMAS=(
  "extensions" "graphql_public" "realtime"
  "supabase_functions" "vault" "pgbouncer" "pgsodium" "net"
  "pg_graphql" "pgaudit" "repmgr" "cron" "information_schema" "pg_catalog"
)
EXCLUDE_ARGS=""
for schema in "${EXCLUDE_SCHEMAS[@]}"; do
  EXCLUDE_ARGS+="--exclude-schema=$schema "
done

# --- 5. Exportar Esquema de la Nube ---
echo -e "\n${GREEN}>>> Exportando el esquema de la base de datos de la NUBE...${NC}"
PGPASSWORD="$PGPASSWORD_CLOUD" pg_dump \
  --schema-only \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  $EXCLUDE_ARGS \
  -h "$PGHOST_CLOUD" \
  -p "$PGPORT_CLOUD" \
  -U "$PGUSER_CLOUD" \
  -d "$PGDATABASE_CLOUD" \
  -f "$SCHEMA_FILE"

if [ $? -ne 0 ]; then
  echo -e "${RED}ERROR: Falló la exportación del esquema de la NUBE. Abortando.${NC}"
  exit 1
fi
echo -e "${GREEN}Esquema exportado a '$SCHEMA_FILE'.${NC}"

# --- 6. Exportar Datos de la Nube ---
echo -e "\n${GREEN}>>> Exportando los datos de la base de datos de la NUBE...${NC}"
PGPASSWORD="$PGPASSWORD_CLOUD" pg_dump \
  --data-only \
  --no-owner \
  --no-privileges \
  $EXCLUDE_ARGS \
  -h "$PGHOST_CLOUD" \
  -p "$PGPORT_CLOUD" \
  -U "$PGUSER_CLOUD" \
  -d "$PGDATABASE_CLOUD" \
  -f "$DATA_FILE"

if [ $? -ne 0 ]; then
  echo -e "${RED}ERROR: Falló la exportación de los datos de la NUBE. Abortando.${NC}"
  rm -f "$SCHEMA_FILE" # Limpiar archivo de esquema si falla la exportación de datos
  exit 1
fi
echo -e "${GREEN}Datos exportados a '$DATA_FILE'.${NC}"

# --- 7. Importar Esquema a la Base de Datos Local ---
echo -e "\n${GREEN}>>> Importando el esquema a la base de datos LOCAL...${NC}"
PGPASSWORD="$PGPASSWORD_LOCAL" psql \
  -h "$PGHOST_LOCAL" \
  -p "$PGPORT_LOCAL" \
  -U "$PGUSER_LOCAL" \
  -d "$PGDATABASE_LOCAL" \
  -f "$SCHEMA_FILE"

if [ $? -ne 0 ]; then
  echo -e "${RED}ERROR: Falló la importación del esquema LOCAL. Abortando.${NC}"
  rm -f "$SCHEMA_FILE" "$DATA_FILE" # Limpiar archivos temporales
  exit 1
fi
echo -e "${GREEN}Esquema importado a la base de datos LOCAL.${NC}"

# --- 8. Importar Datos a la Base de Datos Local ---
echo -e "\n${GREEN}>>> Importando los datos a la base de datos LOCAL...${NC}"
PGPASSWORD="$PGPASSWORD_LOCAL" psql \
  -h "$PGHOST_LOCAL" \
  -p "$PGPORT_LOCAL" \
  -U "$PGUSER_LOCAL" \
  -d "$PGDATABASE_LOCAL" \
  -f "$DATA_FILE"

if [ $? -ne 0 ]; then
  echo -e "${RED}ERROR: Falló la importación de los datos LOCAL. Abortando.${NC}"
  rm -f "$SCHEMA_FILE" "$DATA_FILE" # Limpiar archivos temporales
  exit 1
fi
echo -e "${GREEN}Datos importados a la base de datos LOCAL.${NC}"

# --- 9. Limpiar Archivos Temporales ---
echo -e "\n${GREEN}>>> Limpiando archivos temporales...${NC}"
rm -f "$SCHEMA_FILE" "$DATA_FILE"
echo -e "${GREEN}Archivos temporales eliminados.${NC}"

echo -e "\n${GREEN}=== Migración Completada Exitosamente ===${NC}"
echo -e "${YELLOW}Puede que necesites ejecutar 'supabase db reset' o 'supabase migration up' si tienes migraciones locales que gestionan RLS o funciones que interactúan con los esquemas de Supabase.${NC}"