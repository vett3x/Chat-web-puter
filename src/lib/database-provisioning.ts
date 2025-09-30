"use server";

import { createClient } from '@supabase/supabase-js';
import { Client as PgClient } from 'pg';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AppDatabaseCredentials {
  db_host: string;
  db_port: number;
  db_name: string; // This will be the schema name
  db_user: string;
  db_password: string;
}

/**
 * Generates a random string for database names/users/passwords.
 * @param length The desired length of the random string.
 * @returns A random alphanumeric string.
 */
function generateRandomString(length: number): string {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex') // Convert to hexadecimal format
    .slice(0, length); // Trim to desired length
}

/**
 * Creates a dedicated PostgreSQL schema and user for a new application.
 * It connects to an active database server configured by a Super Admin.
 * @param appId The ID of the application for which to create the database.
 * @returns The credentials for the newly created database schema.
 */
export async function createAppDatabaseSchema(appId: string): Promise<AppDatabaseCredentials> {
  let pgClient: PgClient | null = null;
  try {
    // 1. Find the active database configuration
    const { data: dbConfig, error: configError } = await supabaseAdmin
      .from('database_config')
      .select('*')
      .eq('is_active', true)
      .eq('status', 'ready')
      .single();

    if (configError || !dbConfig) {
      throw new Error('No se encontró una configuración de base de datos activa y lista. Por favor, configura una en el Panel de Administración.');
    }

    // 2. Establish a connection to the PostgreSQL server
    pgClient = new PgClient({
      host: dbConfig.db_host,
      port: dbConfig.db_port,
      database: dbConfig.db_name, // Connect to the admin database (e.g., 'postgres')
      user: dbConfig.db_user,
      password: dbConfig.db_password,
      ssl: false, // Assuming local/private network, adjust if public access
    });

    await pgClient.connect();

    // 3. Generate unique credentials for the new app's schema
    const schemaName = `app_schema_${appId.replace(/-/g, '_')}`; // Use app ID for unique schema name
    const appDbUser = `app_user_${generateRandomString(8)}`;
    const appDbPassword = generateRandomString(24);

    // 4. Execute SQL commands to create schema, user, and grant permissions
    await pgClient.query('BEGIN'); // Start transaction

    // Create schema
    await pgClient.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);

    // Create user and set password
    await pgClient.query(`CREATE USER "${appDbUser}" WITH PASSWORD '${appDbPassword}';`);

    // Grant usage on schema
    await pgClient.query(`GRANT USAGE ON SCHEMA "${schemaName}" TO "${appDbUser}";`);

    // Grant all privileges on all tables/sequences in the schema to the user
    await pgClient.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA "${schemaName}" TO "${appDbUser}";`);
    await pgClient.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "${schemaName}" TO "${appDbUser}";`);
    await pgClient.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA "${schemaName}" GRANT ALL PRIVILEGES ON TABLES TO "${appDbUser}";`);
    await pgClient.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA "${schemaName}" GRANT ALL PRIVILEGES ON SEQUENCES TO "${appDbUser}";`);

    await pgClient.query('COMMIT'); // Commit transaction

    return {
      db_host: dbConfig.db_host,
      db_port: dbConfig.db_port,
      db_name: schemaName, // The schema name is now the "database name" for the app
      db_user: appDbUser,
      db_password: appDbPassword,
    };

  } catch (error: any) {
    if (pgClient) {
      await pgClient.query('ROLLBACK').catch(e => console.error("Error during PG rollback:", e));
    }
    console.error(`[Database Provisioning] Failed to create app database schema for ${appId}:`, error);
    throw new Error(`Error al crear la base de datos para la aplicación: ${error.message}`);
  } finally {
    if (pgClient) {
      await pgClient.end().catch(e => console.error("Error closing PG client:", e));
    }
  }
}