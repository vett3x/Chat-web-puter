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
    const { data, error } = await supabaseAdmin.storage.from('notes-images').list(userId, {
      limit: 1000, // Adjust as needed
      sortBy: { column: 'created_at', order: 'desc' },
    });

    if (error) throw error;

    const filesWithUrls = data.map(file => {
      const { data: { publicUrl } } = supabaseAdmin.storage.from('notes-images').getPublicUrl(`${userId}/${file.name}`);
      return { ...file, publicUrl };
    });

    return NextResponse.json(filesWithUrls);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json({ message: 'Ruta del archivo no proporcionada.' }, { status: 400 });
    }

    // Security check: ensure the user is deleting a file within their own folder
    if (!filePath.startsWith(userId + '/')) {
      return NextResponse.json({ message: 'Acceso denegado para eliminar este archivo.' }, { status: 403 });
    }

    const { error } = await supabaseAdmin.storage.from('notes-images').remove([filePath]);

    if (error) throw error;

    return NextResponse.json({ message: 'Archivo eliminado correctamente.' });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}