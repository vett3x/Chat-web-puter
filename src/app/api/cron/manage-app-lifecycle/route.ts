export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { executeSshCommand } from '@/lib/ssh-utils';

export async function GET() {
  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  let hibernatedCount = 0;
  let suspendedCount = 0;

  try {
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
      message: 'Lifecycle management complete.',
      hibernated: hibernatedCount,
      suspended: suspendedCount,
    });

  } catch (error: any) {
    console.error('[CRON LIFECYCLE] A critical error occurred:', error);
    return NextResponse.json({ message: 'An unexpected error occurred during lifecycle management.' }, { status: 500 });
  }
}