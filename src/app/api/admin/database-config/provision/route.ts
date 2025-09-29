export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { encrypt } from '@/lib/encryption';
import { executeSshCommand, writeRemoteFile } from '@/lib/ssh-utils';
import fs from 'fs/promises';
import path from 'path';

const provisionSchema = z.object({
  ssh_host: z.string().ip({ message: 'Debe ser una IP válida.' }),
  ssh_port: z.coerce.number().int().min(1).default(22),
  ssh_user: z.string().min(1, 'El usuario SSH es requerido.'),
  ssh_password: z.string().min(1, 'La contraseña SSH es requerida.'),
  nickname: z.string().min(1, 'El apodo para esta conexión es requerido.'),
  db_password: z.string().min(6, 'La contraseña de la BD debe tener al menos 6 caracteres.'),
});

async function getIsSuperAdmin(): Promise<boolean> {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
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

  let configId: string | null = null;

  try {
    const body = await req.json();
    const { ssh_host, ssh_port, ssh_user, ssh_password, ...dbConfig } = provisionSchema.parse(body);

    const sshDetails = {
      ip_address: ssh_host,
      ssh_port: ssh_port,
      ssh_username: ssh_user,
      ssh_password: ssh_password,
    };

    // 1. Create the record in the database with 'provisioning' status
    const encryptedPassword = encrypt(dbConfig.db_password);
    const { data: newConfig, error: insertError } = await supabaseAdmin
      .from('database_config')
      .insert({
        nickname: dbConfig.nickname,
        is_active: false,
        db_host: ssh_host,
        db_port: 5432,
        db_name: 'app_db', // Use the dedicated app database name
        db_user: 'app_user', // Use the dedicated app user
        db_password: encryptedPassword,
        status: 'provisioning',
        provisioning_log: 'Iniciando aprovisionamiento...',
      })
      .select('id')
      .single();

    if (insertError) throw insertError;
    configId = newConfig.id;

    // 2. Read the script content from the project
    const scriptPath = path.join(process.cwd(), 'install_postgres.sh');
    const scriptContent = await fs.readFile(scriptPath, 'utf-8');
    const remoteScriptPath = '/tmp/install_postgres.sh';

    // 3. Upload the script to the target server using scp
    await writeRemoteFile(sshDetails, remoteScriptPath, scriptContent);

    // 4. Make the script executable
    await executeSshCommand(sshDetails, `chmod +x ${remoteScriptPath}`);

    // 5. Run the script
    const { stdout, stderr, code } = await executeSshCommand(sshDetails, `sudo ${remoteScriptPath} '${dbConfig.db_password}'`);
    
    const logOutput = `--- STDOUT ---\n${stdout}\n\n--- STDERR ---\n${stderr}`;

    if (code !== 0) {
      throw new Error(`Error durante el aprovisionamiento (código de salida: ${code}).\n\n${logOutput}`);
    }

    // 6. If successful, update status to 'ready' and save log
    await supabaseAdmin.from('database_config').update({ status: 'ready', provisioning_log: logOutput }).eq('id', configId);

    return NextResponse.json({ message: 'Servidor PostgreSQL aprovisionado y configurado exitosamente.', output: stdout });

  } catch (error: any) {
    if (configId) {
      // If any step fails, mark the config as 'failed' and save the log
      await supabaseAdmin.from('database_config').update({ status: 'failed', provisioning_log: error.message }).eq('id', configId);
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error('[API DB Provision] Error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}