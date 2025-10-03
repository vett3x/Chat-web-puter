export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';

const MAX_VERSIONS_TO_SHOW = 20;

async function getUserId() {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { get: (name: string) => cookieStore.get(name)?.value } });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Acceso denegado.');
  return session.user.id;
}

export async function GET(req: NextRequest, context: any) {
  const appId = context.params.id;
  const { searchParams } = new URL(req.url);
  const timestamp = searchParams.get('timestamp'); // Optional timestamp for fetching specific version files

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const userId = await getUserId();

    if (timestamp) {
      // Fetch all files for a specific version (identified by timestamp)
      const { data: version, error: versionError } = await supabaseAdmin
        .from('app_versions')
        .select('id')
        .eq('app_id', appId)
        .eq('user_id', userId)
        .eq('created_at', timestamp)
        .single();

      if (versionError || !version) {
        throw new Error('No se encontró la versión especificada.');
      }

      const { data: files, error: filesError } = await supabaseAdmin
        .from('app_file_backups')
        .select('file_path, file_content')
        .eq('version_id', version.id);

      if (filesError) {
        console.error(`[API /apps/${appId}/versions] Error fetching files for version ${version.id}:`, filesError);
        throw new Error('Error al cargar los archivos de la versión.');
      }

      return NextResponse.json(files);

    } else {
      // Fetch unique timestamps (versions) and their file counts using the new DB function
      const { data, error } = await supabaseAdmin.rpc('get_app_versions_with_file_counts', {
        p_app_id: appId,
        p_user_id: userId,
        p_limit: MAX_VERSIONS_TO_SHOW,
      });

      if (error) {
        console.error(`[API /apps/${appId}/versions] Error fetching versions with RPC:`, error);
        throw new Error('Error al cargar las versiones de la aplicación.');
      }

      return NextResponse.json(data);
    }
  } catch (error: any) {
    console.error(`[API /apps/${appId}/versions] Error:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}