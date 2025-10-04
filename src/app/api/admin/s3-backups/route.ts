export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getActiveS3Client, runBackupForAllApps } from '@/lib/backup-utils';
import { ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';

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

export async function GET(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });

  try {
    const { s3Client, bucketName } = await getActiveS3Client();
    const command = new ListObjectsV2Command({ Bucket: bucketName });
    const { Contents } = await s3Client.send(command);

    const backups = (Contents || [])
      .map(item => {
        const key = item.Key || 'unknown';
        const parts = key.split('_');
        const timestamp = parts.pop()?.replace('.tar.gz', '');
        const appName = parts.join('_');
        
        return {
          key: item.Key,
          appName: appName,
          size: item.Size,
          lastModified: item.LastModified,
          timestamp: timestamp ? new Date(parseInt(timestamp)).toISOString() : item.LastModified?.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.lastModified!).getTime() - new Date(a.lastModified!).getTime());

    return NextResponse.json(backups);
  } catch (error: any) {
    return NextResponse.json({ message: `Error al listar backups: ${error.message}` }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });

  try {
    // No await here, run in background
    runBackupForAllApps().catch(error => {
      console.error('[MANUAL BACKUP] Background backup failed:', error);
    });
    return NextResponse.json({ message: 'Proceso de backup iniciado en segundo plano.' });
  } catch (error: any) {
    return NextResponse.json({ message: `Error al iniciar el backup: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');
  if (!key) return NextResponse.json({ message: 'No se proporcionó la clave del backup.' }, { status: 400 });

  try {
    const { s3Client, bucketName } = await getActiveS3Client();
    const command = new DeleteObjectCommand({ Bucket: bucketName, Key: key });
    await s3Client.send(command);
    return NextResponse.json({ message: 'Backup eliminado correctamente.' });
  } catch (error: any) {
    return NextResponse.json({ message: `Error al eliminar el backup: ${error.message}` }, { status: 500 });
  }
}