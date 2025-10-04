export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runBackupForAllApps } from '@/lib/backup-utils';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const startTime = Date.now();

  try {
    const result = await runBackupForAllApps();
    
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    await supabaseAdmin.from('s3_backup_logs').insert({
      status: 'success',
      details: `Backup completado. ${result.successful_backups} de ${result.total_apps} aplicaciones respaldadas.`,
      duration_seconds: durationSeconds,
      apps_backed_up: result.successful_backups,
      total_size_bytes: 0, // Placeholder for now
    });

    return NextResponse.json({ message: 'Backup process completed.', result });
  } catch (error: any) {
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    await supabaseAdmin.from('s3_backup_logs').insert({
      status: 'failed',
      details: `El proceso de backup falló: ${error.message}`,
      duration_seconds: durationSeconds,
      apps_backed_up: 0,
      total_size_bytes: 0,
    });
    console.error('[CRON RUN-BACKUPS] Error:', error);
    return NextResponse.json({ message: `Error during backup process: ${error.message}` }, { status: 500 });
  }
}