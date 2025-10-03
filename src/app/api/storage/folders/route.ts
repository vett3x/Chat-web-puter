export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';

const createFolderSchema = z.object({
  path: z.string(), // The path inside the user's directory
  folderName: z.string().min(1, 'El nombre de la carpeta no puede estar vacío.'),
});

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

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    const body = await req.json();
    const { path, folderName } = createFolderSchema.parse(body);

    // Sanitize folder name to prevent path traversal
    const sanitizedFolderName = folderName.replace(/\.\.\//g, '');
    if (sanitizedFolderName !== folderName) {
      throw new Error('Nombre de carpeta inválido.');
    }

    const fullPath = `${userId}/${path ? `${path}/` : ''}${sanitizedFolderName}/.placeholder`;

    const { error } = await supabaseAdmin.storage
      .from('notes-images')
      .upload(fullPath, new Blob(['']), {
        cacheControl: '3600',
        upsert: false,
        contentType: 'text/plain',
      });

    if (error) throw error;

    return NextResponse.json({ message: 'Carpeta creada correctamente.' }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}