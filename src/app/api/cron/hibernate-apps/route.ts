export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { executeSshCommand } from '@/lib/ssh-utils';

export async function GET() {
  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Find apps (ready or suspended) inactive for 3 days
  const { data: appsToHibernate, error: findError } = await supabaseAdmin
    .from('user_apps')
    .select('id, container_id, server_id, user_id, user_servers(ip_address, ssh_port, ssh_username, ssh_password)')
    .in('status', ['ready', 'suspended'])
    .lt('last_activity_at', threeDaysAgo);

  if (findError) {
    console.error('[CRON HIBERNATE] Error finding apps to hibernate:', findError);
    return NextResponse.json({ message: 'Error finding apps.' }, { status: 500 });
  }

  if (!appsToHibernate || appsToHibernate.length === 0) {
    return NextResponse.json({ message: 'No apps to hibernate.' });
  }

  let hibernatedCount = 0;
  for (const app of appsToHibernate) {
    const server = app.user_servers as any;
    if (server && app.container_id) {
      try {
        // 2. Backup files
        const { stdout: filesList } = await executeSshCommand(server, `docker exec ${app.container_id} find /app -type f`);
        const files = filesList.trim().split('\n');
        
        const backups = [];
        for (const filePath of files) {
          const { stdout: content } = await executeSshCommand(server, `docker exec ${app.container_id} cat "${filePath}"`);
          backups.push({
            app_id: app.id,
            user_id: app.user_id,
            file_path: filePath.replace('/app/', ''),
            file_content: content,
          });
        }
        await supabaseAdmin.from('app_file_backups').upsert(backups, { onConflict: 'app_id, file_path' });

        // 3. Delete the container
        await executeSshCommand(server, `docker rm -f ${app.container_id}`);

        // 4. Update app status to 'hibernated'
        await supabaseAdmin.from('user_apps').update({ status: 'hibernated', container_id: null, server_id: null }).eq('id', app.id);
        
        hibernatedCount++;
        console.log(`[CRON HIBERNATE] Hibernated app ${app.id}`);
      } catch (error: any) {
        console.error(`[CRON HIBERNATE] Failed to hibernate app ${app.id}:`, error.message);
      }
    }
  }

  return NextResponse.json({ message: `Hibernated ${hibernatedCount} inactive apps.` });
}