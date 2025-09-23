export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { executeSshCommand } from '@/lib/ssh-utils';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

function buildFileTree(paths: string[]): FileNode[] {
  const root: FileNode = { name: 'root', path: '', type: 'directory', children: [] };

  for (const path of paths) {
    if (!path) continue;
    const parts = path.replace('./', '').split('/');
    let currentNode = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      let childNode = currentNode.children?.find(child => child.name === part);

      if (!childNode) {
        const isDirectory = i < parts.length - 1 || !path.includes('.'); // Simple directory check
        childNode = {
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          type: isDirectory ? 'directory' : 'file',
          children: isDirectory ? [] : undefined,
        };
        currentNode.children?.push(childNode);
      }
      currentNode = childNode;
    }
  }
  return root.children || [];
}

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  const appId = context.params.id;
  const cookieStore = cookies() as any;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { get: (name: string) => cookieStore.get(name)?.value } });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: app, error: appError } = await supabaseAdmin.from('user_apps').select('server_id, container_id').eq('id', appId).single();
  if (appError || !app) return NextResponse.json({ message: 'Aplicación no encontrada.' }, { status: 404 });

  const { data: server, error: serverError } = await supabaseAdmin.from('user_servers').select('ip_address, ssh_port, ssh_username, ssh_password').eq('id', app.server_id).single();
  if (serverError || !server) return NextResponse.json({ message: 'Servidor no encontrado.' }, { status: 404 });

  try {
    const command = `find /app -print`; // List all files and directories under /app
    const { stdout, stderr, code } = await executeSshCommand(server, `docker exec ${app.container_id} ${command}`);
    if (code !== 0) throw new Error(`Error al listar archivos: ${stderr}`);
    
    const paths = stdout.trim().split('\n').map(p => p.replace('/app/', '')).filter(p => p && p !== '/app');
    const fileTree = buildFileTree(paths);

    return NextResponse.json(fileTree);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}