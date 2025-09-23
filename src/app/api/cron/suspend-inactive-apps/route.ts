export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { executeSshCommand } from '@/lib/ssh-utils';

export async function GET() {
  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();

  // 1. Find apps that are 'ready' and haven't been active for 20 minutes
  const { data: appsToSuspend, error: findError } = await supabaseAdmin
    .from('user_apps')
    .select('id, container_id, server_id, user_servers(ip_address, ssh_port, ssh_username, ssh_password)')
    .eq('status', 'ready')
    .lt('last_activity_at', twentyMinutesAgo);

  if (findError) {
    console.error('[CRON SUSPEND] Error finding apps to suspend:', findError);
    return NextResponse.json({ message: 'Error finding apps.' }, { status: 500 });
  }

  if (!appsToSuspend || appsToSuspend.length === 0) {
    return NextResponse.json({ message: 'No apps to suspend.' });
  }

  let suspendedCount = 0;
  for (const app of appsToSuspend) {
    const server = app.user_servers as any;
    if (server && app.container_id) {
      try {
        // 2. Stop the container
        await executeSshCommand(server, `docker stop ${app.container_id}`);
        
        // 3. Update the app status to 'suspended'
        await supabaseAdmin.from('user_apps').update({ status: 'suspended' }).eq('id', app.id);
        
        suspendedCount++;
        console.log(`[CRON SUSPEND] Suspended app ${app.id}, container ${app.container_id}`);
      } catch (error: any) {
        console.error(`[CRON SUSPEND] Failed to suspend app ${app.id}:`, error.message);
      }
    }
  }

  return NextResponse.json({ message: `Suspended ${suspendedCount} inactive apps.` });
}