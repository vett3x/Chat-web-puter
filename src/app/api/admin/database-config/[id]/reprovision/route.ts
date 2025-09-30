export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { executeSshCommand, writeRemoteFile } from '@/lib/ssh-utils';
import fs from 'fs/promises';
import path from 'path';

const reprovisionSchema = z.object({
  ssh_password: z.string().min(1, 'La contraseña SSH es requerida.'),
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

export async function POST(req: NextRequest, context: any) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
  }

  const configId = context.params.id;
  if (!configId) {
    return NextResponse.json({ message: 'ID de configuración no proporcionado.' }, { status: 400 });
  }

  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { data: config, error: fetchError } = await supabaseAdmin
      .from('database_config')
      .select('*')
      .eq('id', configId)
      .single();

    if (fetchError || !config) {
      throw new Error('Configuración de base de datos no encontrada.');
    }

    const body = await req.json();
    const { ssh_password, db_password } = reprovisionSchema.parse(body);

    await supabaseAdmin.from('database_config').update({ status: 'provisioning', provisioning_log: 'Iniciando reinstalación...' }).eq('id', configId);

    const sshDetails = {
      ip_address: config.db_host,
      ssh_port: 22, // Assuming default
      ssh_username: 'root', // Assuming default
      ssh_password: ssh_password,
    };

    const scriptPath = path.join(process.cwd(), 'install_postgres.sh');
    const scriptContent = await fs.readFile(scriptPath, 'utf-8');
    const remoteScriptPath = '/tmp/install_postgres.sh';

    await writeRemoteFile(sshDetails, remoteScriptPath, scriptContent);
    await executeSshCommand(sshDetails, `chmod +x ${remoteScriptPath}`);
    const { stdout, stderr, code } = await executeSshCommand(sshDetails, `sudo ${remoteScriptPath} '${db_password}'`);
    
    const logOutput = `--- REPROVISION STDOUT ---\n${stdout}\n\n--- REPROVISION STDERR ---\n${stderr}`;

    if (code !== 0) {
      throw new Error(`Error durante la reinstalación (código de salida: ${code}).\n\n${logOutput}`);
    }

    await supabaseAdmin.from('database_config').update({ 
      status: 'ready', 
      provisioning_log: logOutput,
      db_password: db_password // Store plain text
    }).eq('id', configId);

    return NextResponse.json({ message: 'Servidor PostgreSQL reinstalado y configurado exitosamente.', output: stdout });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    await supabaseAdmin.from('database_config').update({ status: 'failed', provisioning_log: `Error durante la reinstalación: ${error.message}` }).eq('id', configId);
    console.error(`[API DB Reprovision] Error for config ${configId}:`, error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}