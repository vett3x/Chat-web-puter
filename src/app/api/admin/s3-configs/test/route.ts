export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

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

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ message: 'ID de configuración no proporcionado.' }, { status: 400 });

  try {
    const { data: config, error: fetchError } = await supabaseAdmin
      .from('s3_storage_configs')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !config) throw new Error('Configuración no encontrada.');

    const accessKeyId = config.access_key_id;
    const secretAccessKey = config.secret_access_key;

    if (!accessKeyId || !secretAccessKey) throw new Error('Las credenciales de S3 no están completas.');

    const s3Client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true, // Important for MinIO and other S3-compatibles
    });

    await s3Client.send(new ListObjectsV2Command({ Bucket: config.bucket_name, MaxKeys: 1 }));

    await supabaseAdmin.from('s3_storage_configs').update({ status: 'verified', last_tested_at: new Date().toISOString() }).eq('id', id);

    return NextResponse.json({ message: 'Conexión exitosa.' });
  } catch (error: any) {
    await supabaseAdmin.from('s3_storage_configs').update({ status: 'failed', last_tested_at: new Date().toISOString() }).eq('id', id);
    console.error('[S3 Test Connection] Error:', error);
    return NextResponse.json({ message: `Falló la prueba de conexión: ${error.name} - ${error.message}` }, { status: 400 });
  }
}