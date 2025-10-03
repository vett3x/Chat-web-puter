export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

async function getUserId() {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Acceso denegado.');
  return session.user.id;
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path') || '';

    const listPath = path ? `${userId}/${path}` : userId;

    const { data, error } = await supabaseAdmin.storage.from('notes-images').list(listPath, {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) throw error;

    const items = data
      .filter(item => item.name !== '.placeholder') // Filter out placeholder files
      .map(item => {
        const isFolder = !item.id; // In Supabase list, folders don't have an ID
        const fullPath = `${listPath}/${item.name}`;
        const { data: { publicUrl } } = supabaseAdmin.storage.from('notes-images').getPublicUrl(fullPath);
        return { ...item, publicUrl, type: isFolder ? 'folder' : 'file', path: fullPath };
      });

    // Sort folders before files
    items.sort((a, b) => {
      if (a.type === 'folder' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json(items);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path');
    const type = searchParams.get('type');

    if (!path) {
      return NextResponse.json({ message: 'Ruta del archivo o carpeta no proporcionada.' }, { status: 400 });
    }

    if (!path.startsWith(userId + '/')) {
      return NextResponse.json({ message: 'Acceso denegado para eliminar este recurso.' }, { status: 403 });
    }

    if (type === 'folder') {
      const { data: filesInFolder, error: listError } = await supabaseAdmin.storage.from('notes-images').list(path);
      if (listError) throw listError;

      const filePaths = filesInFolder.map(file => `${path}/${file.name}`);
      if (filePaths.length > 0) {
        const { error: removeError } = await supabaseAdmin.storage.from('notes-images').remove(filePaths);
        if (removeError) throw removeError;
      }
    } else {
      const { error } = await supabaseAdmin.storage.from('notes-images').remove([path]);
      if (error) throw error;
    }

    return NextResponse.json({ message: 'Recurso eliminado correctamente.' });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}