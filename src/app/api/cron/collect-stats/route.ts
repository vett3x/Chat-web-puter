export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { executeSshCommand } from '@/lib/ssh-utils';
import { parseMemoryString } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  let statsCollectedCount = 0;

  try {
    const { data: readyServers, error: findServersError } = await supabaseAdmin
      .from('user_servers')
      .select('*')
      .eq('status', 'ready');

    if (findServersError) {
      console.error('[CRON STATS] Error finding ready servers:', findServersError);
      throw findServersError;
    }

    if (readyServers && readyServers.length > 0) {
      for (const server of readyServers) {
        try {
          const cpuCommand = `LC_ALL=C top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk '{print 100 - $1}'`;
          const memCommand = `LC_ALL=C free -m | awk '/^Mem:/{print $3, $2}'`;
          const diskCommand = `LC_ALL=C df -h / | awk 'NR==2{print $5}'`;
          const networkCommand = `LC_ALL=C cat /proc/net/dev | awk 'NR>2 && $1 !~ /lo/ {rx+=$2; tx+=$10} END {print rx, tx}'`;

          const [cpuOutput, memOutput, diskOutput, networkOutput] = await Promise.all([
            executeSshCommand(server, cpuCommand),
            executeSshCommand(server, memCommand),
            executeSshCommand(server, diskCommand),
            executeSshCommand(server, networkCommand),
          ]);

          const cpu_usage_percent = parseFloat(cpuOutput.stdout);
          const [raw_memory_used_str] = memOutput.stdout.split(/\s+/);
          const disk_usage_percent = parseFloat(diskOutput.stdout.replace('%', ''));
          const [rxBytes, txBytes] = networkOutput.stdout.split(/\s+/).map(Number);
          const memory_used_mib = parseMemoryString(raw_memory_used_str || '0B');

          const logEntry = {
            server_id: server.id,
            user_id: server.user_id,
            cpu_usage: isNaN(cpu_usage_percent) ? 0 : cpu_usage_percent,
            memory_usage_mib: memory_used_mib,
            disk_usage_percent: isNaN(disk_usage_percent) ? 0 : disk_usage_percent,
            network_rx_bytes: rxBytes || 0,
            network_tx_bytes: txBytes || 0,
          };

          await supabaseAdmin.from('server_resource_logs').insert(logEntry);
          statsCollectedCount++;
        } catch (error: any) {
          console.error(`[CRON STATS] Failed to collect stats for server ${server.id}:`, error.message);
        }
      }
    }

    return NextResponse.json({ 
      message: 'Stats collection complete.',
      stats_collected_for_servers: statsCollectedCount,
    });

  } catch (error: any) {
    console.error('[CRON STATS] A critical error occurred:', error);
    return NextResponse.json({ message: 'An unexpected error occurred during stats collection.' }, { status: 500 });
  }
}