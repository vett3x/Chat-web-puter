export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

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

  try {
    const userId = await getUserId();

    if (timestamp) {
      // Fetch all files for a specific timestamp (version)
      const { data: files, error } = await supabaseAdmin
        .from('app_file_backups')
        .select('file_path, file_content')
        .eq('app_id', appId)
        .eq('user_id', userId)
        .eq('created_at', timestamp); // Filter by exact timestamp

      if (error) {
        console.error(`[API /apps/${appId}/versions] Error fetching files for timestamp ${timestamp}:`, error);
        throw new Error('Error al cargar los archivos de la versión.');
      }

      return NextResponse.json(files);

    } else {
      // Fetch unique timestamps (versions) and their file counts
      const { data, error } = await supabaseAdmin
        .from('app_file_backups')
        .select('created_at, file_path') // Select file_path to count
        .eq('app_id', appId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(`[API /apps/${appId}/versions] Error fetching versions:`, error);
        throw new Error('Error al cargar las versiones de la aplicación.');
      }

      // Group by created_at and count files
      const versionsMap = new Map<string, number>();
      data?.forEach(row => {
        const createdAt = row.created_at;
        versionsMap.set(createdAt, (versionsMap.get(createdAt) || 0) + 1);
      });

      const versions = Array.from(versionsMap.entries()).map(([createdAt, file_count]) => ({
        created_at: createdAt,
        file_count: file_count,
      }));

      return NextResponse.json(versions);
    }
  } catch (error: any) {
    console.error(`[API /apps/${appId}/versions] Error:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}