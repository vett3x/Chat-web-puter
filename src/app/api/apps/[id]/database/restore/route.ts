export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Client as PgClient } from 'pg';
import { getAppAndServerWithStateCheck } from '@/lib/app-state-manager';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function getUserId() {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { get: (name: string) => cookieStore.get(name)?.value } });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Acceso denegado.');
  return session.user.id;
}

export async function POST(req: NextRequest, context: any) {
  const appId = context.params.id;
  let pgClient: PgClient | null = null;

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const userId = await getUserId();
    const { app } = await getAppAndServerWithStateCheck(appId, userId);

    if (!app.db_host || !app.db_port || !app.db_name || !app.db_user || !app.db_password) {
      throw new Error('La configuración de la base de datos para esta aplicación es incompleta.');
    }

    const { version_id } = await req.json();
    if (!version_id) {
      throw new Error('No se proporcionó el ID de la versión para restaurar.');
    }

    const { data: versionData, error: versionError } = await supabaseAdmin
      .from('app_versions')
      .select('db_schema_dump, db_data_dump')
      .eq('id', version_id)
      .eq('app_id', appId)
      .eq('user_id', userId)
      .single();

    if (versionError || !versionData) {
      throw new Error('No se encontró la versión de la base de datos para restaurar.');
    }

    pgClient = new PgClient({
      host: app.db_host,
      port: app.db_port,
      database: 'postgres', // Connect to the main DB to drop/create schema
      user: 'postgres', // Assuming we need admin rights for this
      password: process.env.DB_SUPER_ADMIN_PASSWORD, // This needs to be the super admin password for the DB server
      ssl: false,
    });
    await pgClient.connect();

    await pgClient.query('BEGIN');
    
    // Drop the existing schema and all its objects
    await pgClient.query(`DROP SCHEMA IF EXISTS "${app.db_name}" CASCADE;`);
    
    // Re-create the schema and grant permissions
    await pgClient.query(`CREATE SCHEMA "${app.db_name}";`);
    await pgClient.query(`GRANT USAGE ON SCHEMA "${app.db_name}" TO "${app.db_user}";`);
    await pgClient.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA "${app.db_name}" TO "${app.db_user}";`);
    await pgClient.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "${app.db_name}" TO "${app.db_user}";`);
    await pgClient.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA "${app.db_name}" GRANT ALL PRIVILEGES ON TABLES TO "${app.db_user}";`);
    await pgClient.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA "${app.db_name}" GRANT ALL PRIVILEGES ON SEQUENCES TO "${app.db_user}";`);

    // Restore schema if it exists
    if (versionData.db_schema_dump) {
      await pgClient.query(versionData.db_schema_dump);
    }
    
    // Restore data if it exists
    if (versionData.db_data_dump) {
      await pgClient.query(versionData.db_data_dump);
    }

    await pgClient.query('COMMIT');

    return NextResponse.json({ message: 'Base de datos restaurada exitosamente.' });

  } catch (error: any) {
    if (pgClient) {
      await pgClient.query('ROLLBACK').catch(e => console.error("Error during PG rollback:", e));
    }
    console.error(`[API DB Restore /apps/${appId}] Error:`, error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  } finally {
    if (pgClient) {
      await pgClient.end().catch(e => console.error("Error closing PG client:", e));
    }
  }
}