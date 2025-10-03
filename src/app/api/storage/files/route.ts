export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const VIRTUAL_PROJECTS_FOLDER = 'Proyectos DeepAI Coder';

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

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

// Define the StoredItem type to be used within this API route
interface StoredItem {
  id: string | null;
  name: string;
  created_at: string;
  metadata?: {
    size: number;
    mimetype: string;
  };
  publicUrl: string;
  type: 'file' | 'folder';
  path: string;
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
        const isDirectory = i < parts.length - 1;
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

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path') || '';

    // --- Logic for DeepAI Coder Projects ---
    if (path.startsWith(VIRTUAL_PROJECTS_FOLDER)) {
      const pathParts = path.split('/');
      
      // If path is "Proyectos DeepAI Coder", list the projects
      if (pathParts.length === 1) {
        const { data: apps, error: appsError } = await supabaseAdmin
          .from('user_apps')
          .select('id, name, created_at')
          .eq('user_id', userId);
        if (appsError) throw appsError;
        
        const projectFolders: StoredItem[] = apps.map(app => ({
          id: null,
          name: app.name,
          created_at: app.created_at,
          metadata: undefined,
          publicUrl: '',
          type: 'folder' as const,
          path: `${VIRTUAL_PROJECTS_FOLDER}/${app.id}`, // Use ID in path for uniqueness
        }));
        return NextResponse.json(projectFolders);
      }
      
      // If path is "Proyectos DeepAI Coder/app_id", list files for that app
      if (pathParts.length === 2) {
        const appId = pathParts[1];
        const { data: latestVersion, error: versionError } = await supabaseAdmin
          .from('app_versions')
          .select('id')
          .eq('app_id', appId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (versionError || !latestVersion) {
          return NextResponse.json([]); // No versions found
        }

        const { data: files, error: filesError } = await supabaseAdmin
          .from('app_file_backups')
          .select('file_path, file_content, created_at, file_size')
          .eq('version_id', latestVersion.id);

        if (filesError) throw filesError;

        const filePaths = files.map(f => f.file_path);
        const fileTree = buildFileTree(filePaths);

        const mapNodeToItem = (node: FileNode): StoredItem => ({
          id: null,
          name: node.name,
          created_at: files.find(f => f.file_path === node.path)?.created_at || new Date().toISOString(),
          metadata: node.type === 'file' ? {
            size: files.find(f => f.file_path === node.path)?.file_size || 0,
            mimetype: 'application/octet-stream',
          } : undefined,
          publicUrl: '',
          type: node.type === 'directory' ? 'folder' : 'file',
          path: `${VIRTUAL_PROJECTS_FOLDER}/${appId}/${node.path}`,
        });

        const items: StoredItem[] = fileTree.map(mapNodeToItem);
        return NextResponse.json(items);
      }
      
      // If path is deeper inside a project, handle file download (or just show empty for now)
      return NextResponse.json([]);
    }

    // --- Default Logic for Supabase Storage ---
    const listPath = path ? `${userId}/${path}` : userId;
    const { data, error } = await supabaseAdmin.storage.from('notes-images').list(listPath, {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;

    let items: StoredItem[] = data
      .filter(item => item.name !== '.placeholder')
      .map((item): StoredItem => {
        const isFolder = !item.id;
        const fullPath = `${listPath}/${item.name}`;
        const { data: { publicUrl } } = supabaseAdmin.storage.from('notes-images').getPublicUrl(fullPath);
        return {
          id: item.id,
          name: item.name,
          created_at: item.created_at,
          metadata: isFolder ? undefined : {
            size: item.metadata?.size ?? 0,
            mimetype: item.metadata?.mimetype ?? 'application/octet-stream'
          },
          publicUrl,
          type: isFolder ? 'folder' : 'file',
          path: fullPath,
        };
      });

    // Add the virtual folder at the root
    if (path === '') {
      items.unshift({
        id: 'virtual-projects-folder',
        name: VIRTUAL_PROJECTS_FOLDER,
        created_at: new Date().toISOString(),
        publicUrl: '',
        type: 'folder' as const,
        path: VIRTUAL_PROJECTS_FOLDER,
        metadata: undefined,
      });
    }

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
    
    // Prevent deleting virtual project folder
    if (path.startsWith(VIRTUAL_PROJECTS_FOLDER)) {
      return NextResponse.json({ message: 'Los proyectos de DeepAI Coder no se pueden eliminar desde aquí.' }, { status: 403 });
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