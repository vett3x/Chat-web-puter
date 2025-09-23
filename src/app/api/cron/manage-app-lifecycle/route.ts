export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { executeSshCommand } from '@/lib/ssh-utils';
import { parseMemoryString } from '@/lib/utils';

export async function GET() {
  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  let statsCollectedCount = 0;
  let hibernatedCount = 0;
  let suspendedCount = 0;

  try {
    // --- STATS COLLECTION LOGIC ---
    const { data: readyServers, error: findServersError } = await supabaseAdmin
      .from('user_servers')
      .select('*')
      .eq('status', 'ready');

    if (findServersError) {
      console.error('[CRON LIFECYCLE] Error finding ready servers for stats collection:', findServersError);
    } else if (readyServers && readyServers.length > 0) {
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
          console.error(`[CRON LIFECYCLE] Failed to collect stats for server ${server.id}:`, error.message);
        }
      }
    }

    // --- HIBERNATION LOGIC ---
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: appsToHibernate, error: findHibernateError } = await supabaseAdmin
      .from('user_apps')
      .select('id, container_id, server_id, user_id, user_servers(ip_address, ssh_port, ssh_username, ssh_password)')
      .in('status', ['ready', 'suspended'])
      .lt('last_activity_at', threeDaysAgo);

    if (findHibernateError) {
      console.error('[CRON LIFECYCLE] Error finding apps to hibernate:', findHibernateError);
    } else if (appsToHibernate && appsToHibernate.length > 0) {
      for (const app of appsToHibernate) {
        const server = app.user_servers as any;
        if (server && app.container_id) {
          try {
            const { stdout: filesList } = await executeSshCommand(server, `docker exec ${app.container_id} find /app -type f`);
            const files = filesList.trim().split('\n');
            
            const backups = [];
            for (const filePath of files) {
              if (!filePath) continue;
              const { stdout: content } = await executeSshCommand(server, `docker exec ${app.container_id} cat "${filePath}"`);
              backups.push({
                app_id: app.id,
                user_id: app.user_id,
                file_path: filePath.replace('/app/', ''),
                file_content: content,
              });
            }
            if (backups.length > 0) {
              await supabaseAdmin.from('app_file_backups').upsert(backups, { onConflict: 'app_id, file_path' });
            }

            await executeSshCommand(server, `docker rm -f ${app.container_id}`);
            await supabaseAdmin.from('user_apps').update({ status: 'hibernated', container_id: null, server_id: null }).eq('id', app.id);
            
            hibernatedCount++;
            console.log(`[CRON LIFECYCLE] Hibernated app ${app.id}`);
          } catch (error: any) {
            console.error(`[CRON LIFECYCLE] Failed to hibernate app ${app.id}:`, error.message);
          }
        }
      }
    }

    // --- SUSPENSION LOGIC ---
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const { data: appsToSuspend, error: findSuspendError } = await supabaseAdmin
      .from('user_apps')
      .select('id, container_id, server_id, user_servers(ip_address, ssh_port, ssh_username, ssh_password)')
      .eq('status', 'ready') // Only suspend apps that are currently ready
      .lt('last_activity_at', twentyMinutesAgo);

    if (findSuspendError) {
      console.error('[CRON LIFECYCLE] Error finding apps to suspend:', findSuspendError);
    } else if (appsToSuspend && appsToSuspend.length > 0) {
      for (const app of appsToSuspend) {
        const server = app.user_servers as any;
        if (server && app.container_id) {
          try {
            await executeSshCommand(server, `docker stop ${app.container_id}`);
            await supabaseAdmin.from('user_apps').update({ status: 'suspended' }).eq('id', app.id);
            
            suspendedCount++;
            console.log(`[CRON LIFECYCLE] Suspended app ${app.id}, container ${app.container_id}`);
          } catch (error: any) {
            console.error(`[CRON LIFECYCLE] Failed to suspend app ${app.id}:`, error.message);
          }
        }
      }
    }

    return NextResponse.json({ 
      message: 'Lifecycle management and stats collection complete.',
      stats_collected_for: statsCollectedCount,
      hibernated: hibernatedCount,
      suspended: suspendedCount,
    });

  } catch (error: any) {
    console.error('[CRON LIFECYCLE] A critical error occurred:', error);
    return NextResponse.json({ message: 'An unexpected error occurred during lifecycle management.' }, { status: 500 });
  }
}