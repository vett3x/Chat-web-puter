export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

const apiKeySchema = z.object({
  provider: z.string().min(1),
  api_key: z.string().optional(), // Make optional
  nickname: z.string().optional(),
  project_id: z.string().optional(),
  location_id: z.string().optional(),
  use_vertex_ai: z.boolean().optional(),
  model_name: z.string().optional(), // New: model_name
  json_key_content: z.string().optional(), // New: for Vertex AI JSON key content
});

const updateApiKeySchema = z.object({
  provider: z.string().min(1),
  api_key: z.string().min(10, { message: 'La API Key parece demasiado corta.' }).optional(),
  nickname: z.string().optional(),
  project_id: z.string().optional(),
  location_id: z.string().optional(),
  use_vertex_ai: z.boolean().optional(),
  model_name: z.string().optional(), // New: model_name
  json_key_content: z.string().optional(), // New: for Vertex AI JSON key content
});

async function getSupabaseClient() {
  const cookieStore = cookies() as any;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {},
        remove: (name: string, options: CookieOptions) => {},
      },
    }
  );
}

export async function GET(req: NextRequest) {
  const supabase = await getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('user_api_keys')
    .select('id, provider, api_key, is_active, created_at, nickname, project_id, location_id, use_vertex_ai, model_name') // Select model_name
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  // Mask the API keys before sending them to the client
  const maskedData = data.map(key => ({
    ...key,
    api_key: key.api_key ? `${key.api_key.substring(0, 4)}...${key.api_key.substring(key.api_key.length - 4)}` : null,
  }));

  return NextResponse.json(maskedData);
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { provider, api_key, nickname, project_id, location_id, use_vertex_ai, model_name, json_key_content } = apiKeySchema.parse(body);

    const { data, error } = await supabase
      .from('user_api_keys')
      .insert({
        user_id: session.user.id,
        provider,
        api_key: use_vertex_ai ? null : api_key, // Store null if using Vertex AI
        nickname,
        project_id: use_vertex_ai ? project_id : null,
        location_id: use_vertex_ai ? location_id : null,
        use_vertex_ai: use_vertex_ai || false,
        model_name: use_vertex_ai ? model_name : null, // Store model_name if using Vertex AI
        json_key_content: use_vertex_ai ? json_key_content : null, // Store JSON key content if using Vertex AI
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ message: 'API Key guardada correctamente.', key: data }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const supabase = await getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { provider, api_key, nickname, project_id, location_id, use_vertex_ai, model_name, json_key_content } = updateApiKeySchema.parse(body);

    const updateData: { 
      api_key?: string | null; 
      nickname?: string | null; 
      project_id?: string | null; 
      location_id?: string | null; 
      use_vertex_ai?: boolean; 
      model_name?: string | null;
      json_key_content?: string | null; // New: for Vertex AI JSON key content
    } = {};
    
    if (api_key !== undefined) {
      updateData.api_key = use_vertex_ai ? null : api_key;
    }
    if (nickname !== undefined) {
      updateData.nickname = nickname || null;
    }
    if (project_id !== undefined) {
      updateData.project_id = use_vertex_ai ? project_id : null;
    }
    if (location_id !== undefined) {
      updateData.location_id = use_vertex_ai ? location_id : null;
    }
    if (use_vertex_ai !== undefined) {
      updateData.use_vertex_ai = use_vertex_ai;
      // If switching to Vertex AI, clear api_key
      if (use_vertex_ai) updateData.api_key = null;
      // If switching from Vertex AI, clear project/location, model_name, and json_key_content
      if (!use_vertex_ai) {
        updateData.project_id = null;
        updateData.location_id = null;
        updateData.model_name = null;
        updateData.json_key_content = null;
      }
    }
    if (model_name !== undefined) {
      updateData.model_name = use_vertex_ai ? model_name : null; // Store model_name if using Vertex AI
    }
    if (json_key_content !== undefined) {
      updateData.json_key_content = use_vertex_ai ? json_key_content : null; // Store JSON key content if using Vertex AI
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: 'No se proporcionaron datos para actualizar.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('user_api_keys')
      .update(updateData)
      .eq('user_id', session.user.id)
      .eq('provider', provider)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ message: 'API Key actualizada correctamente.', key: data });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'ID de la clave no proporcionado.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('user_api_keys')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'API Key eliminada correctamente.' });
}