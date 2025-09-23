export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { getAppAndServerWithStateCheck } from '@/lib/app-state-manager';
import { executeSshCommand } from '@/lib/ssh-utils';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function getUserId() {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { get: (name: string) => cookieStore.get(name)?.value } });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Acceso denegado.');
  return session.user.id;
}

export async function POST(req: NextRequest, context: any) {
  const appId = context.params.id;

  try {
    const userId = await getUserId();
    const { app, server } = await getAppAndServerWithStateCheck(appId, userId);

    if (!app.container_id) {
      throw new Error('La aplicación no tiene un contenedor asociado para reiniciar.');
    }

    // Obtener detalles del túnel si existe
    const { data: tunnel } = await supabaseAdmin
      .from('docker_tunnels')
      .select('tunnel_id, tunnel_secret, container_port')
      .eq('container_id', app.container_id) // Search by container_id
      .single();

    // Comandos para reiniciar los servicios DENTRO del contenedor
    // Se ejecutan en secuencia. Si pkill no encuentra un proceso, fallará, pero el siguiente comando se ejecutará igualmente.
    const killAppCommand = "pkill -f 'npm run dev' || true";
    const killTunnelCommand = "pkill cloudflared || true";
    const restartAppCommand = `cd /app && nohup npm run dev -- -p ${tunnel?.container_port || 3000} > /app/dev.log 2>&1 &`;
    
    let commandsToRun = [killAppCommand, killTunnelCommand, restartAppCommand];

    // Si hay un túnel, también lo reiniciamos
    if (tunnel && tunnel.tunnel_id && tunnel.tunnel_secret) {
      const restartTunnelCommand = `nohup cloudflared tunnel run --token ${tunnel.tunnel_secret} ${tunnel.tunnel_id} > /app/cloudflared.log 2>&1 &`;
      commandsToRun.push(restartTunnelCommand);
    }

    // Unimos los comandos con ' && ' que es más robusto para sh
    const commandsToRunInShell = commandsToRun.join(' && ');

    const fullCommand = `docker exec ${app.container_id} sh -c "${commandsToRunInShell}"`;

    const { stderr, code } = await executeSshCommand(server, fullCommand);

    if (code !== 0) {
      // A veces pkill devuelve un código de error si no encuentra procesos, lo cual es esperado.
      // El '|| true' maneja esto, por lo que si aún hay un error, es un problema real.
      if (stderr) {
        throw new Error(`Error al reiniciar los servicios: ${stderr}`);
      }
    }

    return NextResponse.json({ message: 'Los servicios de la aplicación se están reiniciando.' });
  } catch (error: any) {
    console.error(`[API RESTART /apps/${appId}] Error:`, error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}