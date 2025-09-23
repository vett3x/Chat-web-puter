export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { executeSshCommand } from '@/lib/ssh-utils';
import { deleteCloudflareTunnelAndCleanup } from '@/lib/tunnel-orchestration';

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function getUserId() {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { get: (name: string) => cookieStore.get(name)?.value } });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Acceso denegado.');
  return session.user.id;
}

export async function DELETE(req: NextRequest, context: { params: { id: string } }) {
  const appId = context.params.id;

  try {
    const userId = await getUserId();

    // 1. Fetch all necessary details in one go
    const { data: app, error: appError } = await supabaseAdmin
      .from('user_apps')
      .select(`
        *,
        user_servers(*),
        docker_tunnels(*, cloudflare_domains(*))
      `)
      .eq('id', appId)
      .eq('user_id', userId)
      .single();

    if (appError || !app) {
      throw new Error('Aplicación no encontrada o acceso denegado.');
    }

    const server = app.user_servers as any;
    const tunnel = app.docker_tunnels as any;

    // 2. Delete Cloudflare Tunnel if it exists
    if (tunnel && tunnel.cloudflare_domains) {
      await deleteCloudflareTunnelAndCleanup({
        userId,
        serverId: app.server_id!,
        containerId: app.container_id!,
        tunnelRecordId: tunnel.id,
        serverDetails: server,
        cloudflareDomainDetails: tunnel.cloudflare_domains,
      });
    }

    // 3. Delete Docker Container if it exists
    if (app.container_id && server) {
      await executeSshCommand(server, `docker rm -f ${app.container_id}`);
    }

    // 4. Delete the app record from the database (should cascade to backups)
    const { error: deleteAppError } = await supabaseAdmin
      .from('user_apps')
      .delete()
      .eq('id', appId);

    if (deleteAppError) {
      throw new Error(`Error al eliminar el registro de la aplicación: ${deleteAppError.message}`);
    }

    return NextResponse.json({ message: `Proyecto "${app.name}" y todos sus recursos han sido eliminados.` });

  } catch (error: any) {
    console.error(`[API DELETE /apps/${appId}] Error:`, error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}