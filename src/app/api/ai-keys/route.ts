export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

const apiKeySchema = z.object({
  id: z.string().optional(), // Optional for POST, required for PUT
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
  id: z.string().min(1, { message: 'ID de clave es requerido para actualizar.' }), // Required for PUT
  provider: z.string().min(1),
  api_key: z.string().optional(), // Make optional
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
    .select('id, provider, api_key, is_active, created_at, nickname, project_id, location_id, use_vertex_ai, model_name, json_key_content') // Select model_name and json_key_content
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("[API /ai-keys GET] Error fetching keys:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  // Mask the API keys and json_key_content before sending them to the client
  const maskedData = data.map(key => ({
    ...key,
    api_key: key.api_key ? `${key.api_key.substring(0, 4)}...${key.api_key.substring(key.api_key.length - 4)}` : null,
    json_key_content: key.json_key_content ? 'Subido' : null, // Indicate if content exists
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
        model_name: model_name || null, // Store model_name for both types
        json_key_content: use_vertex_ai ? json_key_content : null, // Store JSON key content if using Vertex AI
      })
      .select()
      .single();

    if (error) {
      console.error("[API /ai-keys POST] Error inserting key:", error);
      throw error;
    }

    return NextResponse.json({ message: 'API Key guardada correctamente.', key: data }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error("[API /ai-keys POST] Unhandled error:", error);
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
    const { id, provider, api_key, nickname, project_id, location_id, use_vertex_ai, model_name, json_key_content } = updateApiKeySchema.parse(body);

    const updateData: { 
      api_key?: string | null; 
      nickname?: string | null; 
      project_id?: string | null; 
      location_id?: string | null; 
      use_vertex_ai?: boolean; 
      model_name?: string | null;
      json_key_content?: string | null;
    } = {};
    
    // Only update api_key if it's provided and not empty
    if (api_key !== undefined && api_key !== '') {
      updateData.api_key = use_vertex_ai ? null : api_key;
    } else if (use_vertex_ai) {
      // If switching to Vertex AI and api_key is empty, explicitly set to null
      updateData.api_key = null;
    }

    if (nickname !== undefined) {
      updateData.nickname = nickname || null;
    }
    
    if (use_vertex_ai !== undefined) {
      updateData.use_vertex_ai = use_vertex_ai;
      // If switching to Vertex AI, clear api_key
      if (use_vertex_ai) {
        updateData.api_key = null;
        updateData.project_id = project_id || null;
        updateData.location_id = location_id || null;
        updateData.model_name = model_name || null;
        updateData.json_key_content = json_key_content || null;
      }
      // If switching from Vertex AI, clear Vertex AI specific fields but keep model_name
      if (!use_vertex_ai) {
        updateData.project_id = null;
        updateData.location_id = null;
        updateData.json_key_content = null;
        if (model_name !== undefined) {
          updateData.model_name = model_name || null;
        }
      }
    } else { // If use_vertex_ai is not explicitly changed, update related fields based on its current value
      // This handles cases where only project_id/location_id/model_name/json_key_content are updated
      // without toggling the switch.
      const { data: currentKey, error: currentKeyError } = await supabase
        .from('user_api_keys')
        .select('use_vertex_ai')
        .eq('id', id)
        .eq('user_id', session.user.id)
        .single();

      if (currentKeyError || !currentKey) throw new Error('Clave no encontrada para verificar el estado de Vertex AI.');

      if (currentKey.use_vertex_ai) {
        if (project_id !== undefined) updateData.project_id = project_id || null;
        if (location_id !== undefined) updateData.location_id = location_id || null;
        if (model_name !== undefined) updateData.model_name = model_name || null;
        if (json_key_content !== undefined) updateData.json_key_content = json_key_content || null;
      } else {
        if (model_name !== undefined) updateData.model_name = model_name || null; // Update model_name for public API
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: 'No se proporcionaron datos para actualizar.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('user_api_keys')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error) {
      console.error("[API /ai-keys PUT] Error updating key:", error);
      throw error;
    }

    return NextResponse.json({ message: 'API Key actualizada correctamente.', key: data });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    }
    console.error("[API /ai-keys PUT] Unhandled error:", error);
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
    console.error("[API /ai-keys DELETE] Error deleting key:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'API Key eliminada correctamente.' });
}