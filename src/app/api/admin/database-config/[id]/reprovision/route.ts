export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/encryption';
import { executeSshCommand, writeRemoteFile } from '@/lib/ssh-utils';
import fs from 'fs/promises';
import path from 'path';

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

    await supabaseAdmin.from('database_config').update({ status: 'provisioning', provisioning_log: 'Iniciando reinstalación...' }).eq('id', configId);

    const sshDetails = {
      ip_address: config.db_host,
      ssh_port: 22, // Assuming default, as it's not stored
      ssh_username: 'root', // Assuming default
      ssh_password: '', // This needs to be provided somehow, or use key-based auth
    };
    
    // This is a limitation: we don't store the SSH password.
    // For now, we'll assume the user needs to re-enter it or we can't reprovision.
    // Let's throw a clear error for now.
    return NextResponse.json({ message: 'La reinstalación automática no está soportada actualmente por razones de seguridad (no se almacenan las contraseñas SSH). Por favor, elimina y vuelve a aprovisionar la configuración.' }, { status: 501 });

  } catch (error: any) {
    await supabaseAdmin.from('database_config').update({ status: 'failed', provisioning_log: `Error durante la reinstalación: ${error.message}` }).eq('id', configId);
    console.error(`[API DB Reprovision] Error for config ${configId}:`, error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}