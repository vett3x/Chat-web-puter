export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/encryption';
import { Client as PgClient } from 'pg';

async function getIsSuperAdmin(): Promise<boolean> {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
      },
    }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  return profile?.role === 'super_admin';
}

export async function POST(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const pgClient = new PgClient();

  try {
    const { data: config, error: fetchError } = await supabaseAdmin
      .from('database_config')
      .select('*')
      .single();

    if (fetchError || !config) {
      throw new Error('No se encontró la configuración de la base de datos. Por favor, guárdala primero.');
    }

    const decryptedPassword = decrypt(config.db_password);

    pgClient.host = config.db_host;
    pgClient.port = config.db_port;
    pgClient.database = config.db_name;
    pgClient.user = config.db_user;
    pgClient.password = decryptedPassword;

    await pgClient.connect();

    // Test permissions by creating and dropping a temporary schema
    const testSchemaName = `dyad_connection_test_${Date.now()}`;
    await pgClient.query(`CREATE SCHEMA ${testSchemaName};`);
    await pgClient.query(`DROP SCHEMA ${testSchemaName};`);

    return NextResponse.json({ message: 'Conexión exitosa y permisos de administrador verificados.' });

  } catch (error: any) {
    console.error('[DB Test Connection] Error:', error);
    // Provide a more user-friendly error message
    let errorMessage = 'Error desconocido.';
    if (error.code === '28P01') {
      errorMessage = 'Autenticación fallida. Revisa el usuario y la contraseña.';
    } else if (error.code === '3D000') {
      errorMessage = `La base de datos '${pgClient.database}' no existe.`;
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorMessage = `No se pudo conectar al host '${pgClient.host}'. Revisa el host y el puerto.`;
    } else if (error.message.includes('permission denied to create schema')) {
        errorMessage = 'Conexión exitosa, pero el usuario no tiene permisos de administrador para crear esquemas.';
    } else {
      errorMessage = error.message;
    }
    return NextResponse.json({ message: `Falló la prueba de conexión: ${errorMessage}` }, { status: 400 });
  } finally {
    await pgClient.end();
  }
}