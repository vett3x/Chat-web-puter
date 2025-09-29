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
import crypto from 'crypto';

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
  const remotePassFilePath = `/tmp/${crypto.randomBytes(16).toString('hex')}.pass`;
  let sshDetails: any = null;

  try {
    const body = await req.json();
    const { ssh_host, ssh_port, ssh_user, ssh_password, ...dbConfig } = provisionSchema.parse(body);

    sshDetails = {
      ip_address: ssh_host,
      ssh_port: ssh_port,
      ssh_username: ssh_user,
      ssh_password: ssh_password,
    };

    const encryptedPassword = encrypt(dbConfig.db_password);
    const { data: newConfig, error: insertError } = await supabaseAdmin
      .from('database_config')
      .insert({
        nickname: dbConfig.nickname,
        is_active: false,
        db_host: ssh_host,
        db_port: 5432,
        db_name: 'app_db',
        db_user: 'app_user',
        db_password: encryptedPassword,
        status: 'provisioning',
        provisioning_log: 'Iniciando aprovisionamiento...',
      })
      .select('id')
      .single();

    if (insertError) throw insertError;
    configId = newConfig.id;

    const scriptPath = path.join(process.cwd(), 'install_postgres.sh');
    const scriptContent = await fs.readFile(scriptPath, 'utf-8');
    const remoteScriptPath = '/tmp/install_postgres.sh';

    await writeRemoteFile(sshDetails, remotePassFilePath, dbConfig.db_password);
    await writeRemoteFile(sshDetails, remoteScriptPath, scriptContent);
    await executeSshCommand(sshDetails, `chmod +x ${remoteScriptPath}`);

    const { stdout, stderr, code } = await executeSshCommand(sshDetails, `sudo ${remoteScriptPath} ${remotePassFilePath}`);
    
    const logOutput = `--- STDOUT ---\n${stdout}\n\n--- STDERR ---\n${stderr}`;

    if (code !== 0) {
      throw new Error(`Error durante el aprovisionamiento (código de salida: ${code}).\n\n${logOutput}`);
    }

    await supabaseAdmin.from('database_config').update({ status: 'ready', provisioning_log: logOutput }).eq('id', configId);

    return NextResponse.json({ message: 'Servidor PostgreSQL aprovisionado y configurado exitosamente.', output: stdout });

  } catch (error: any) {
    if (configId) {
      await supabaseAdmin.from('database_config').update({ status: 'failed', provisioning_log: error.message }).eq('id', configId);
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error('[API DB Provision] Error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  } finally {
    if (sshDetails) {
      // Clean up the remote script file, the password file is deleted by the script itself
      await executeSshCommand(sshDetails, `rm -f /tmp/install_postgres.sh`).catch(e => console.warn("Failed to cleanup remote script file"));
    }
  }
}