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
  api_endpoint: z.string().url({ message: 'URL de endpoint inválida.' }).optional(), // New: for custom endpoint
});

const updateApiKeySchema = z.object({
  id: z.string().min(1, { message: 'ID de clave es requerido para actualizar.' }), // Required for PUT
  provider: z.string().min(1),
  api_key: z.string().optional(),
  nickname: z.string().optional(),
  project_id: z.string().optional(),
  location_id: z.string().optional(),
  use_vertex_ai: z.boolean().optional(),
  model_name: z.string().optional(),
  json_key_file: z.any().optional(),
  json_key_content: z.string().optional(),
  api_endpoint: z.string().url({ message: 'URL de endpoint inválida.' }).optional(), // New: for custom endpoint
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
    .select('id, provider, api_key, is_active, created_at, nickname, project_id, location_id, use_vertex_ai, model_name, json_key_content, api_endpoint') // Select model_name, json_key_content, api_endpoint
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
    const { provider, api_key, nickname, project_id, location_id, use_vertex_ai, model_name, json_key_content, api_endpoint } = apiKeySchema.parse(body);

    const insertData: any = {
      user_id: session.user.id,
      provider,
      nickname: nickname || null,
      model_name: model_name || null,
      is_active: true, // Default to active
    };

    if (provider === 'google_gemini') {
      insertData.use_vertex_ai = use_vertex_ai || false;
      if (use_vertex_ai) {
        insertData.project_id = project_id || null;
        insertData.location_id = location_id || null;
        insertData.json_key_content = json_key_content || null;
        insertData.api_key = null; // API key is not used for Vertex AI
      } else {
        insertData.api_key = api_key || null;
      }
    } else if (provider === 'custom_endpoint') {
      insertData.api_endpoint = api_endpoint || null;
      insertData.api_key = api_key || null;
      insertData.use_vertex_ai = false; // Ensure false for custom endpoint
    } else { // Other providers (e.g., Anthropic if we add direct API key support)
      insertData.api_key = api_key || null;
      insertData.use_vertex_ai = false; // Ensure false
    }

    const { data, error } = await supabase
      .from('user_api_keys')
      .insert(insertData)
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
    const { id, provider, api_key, nickname, project_id, location_id, use_vertex_ai, model_name, json_key_content, api_endpoint } = updateApiKeySchema.parse(body);

    const updateData: any = {
      nickname: nickname || null,
      model_name: model_name || null,
    };
    
    // Fetch current key details to determine existing provider and use_vertex_ai status
    const { data: currentKey, error: currentKeyError } = await supabase
      .from('user_api_keys')
      .select('provider, use_vertex_ai')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (currentKeyError || !currentKey) throw new Error('Clave no encontrada para verificar el estado.');

    // Handle API Key update: only if provided and not empty
    if (api_key !== undefined && api_key !== '') {
      updateData.api_key = api_key;
    }

    // Logic based on provider and use_vertex_ai flag
    if (currentKey.provider === 'google_gemini') {
      updateData.use_vertex_ai = use_vertex_ai; // Always update this flag if present in payload
      if (use_vertex_ai) { // If switching to or already using Vertex AI
        updateData.api_key = null; // Clear public API key
        updateData.project_id = project_id || null;
        updateData.location_id = location_id || null;
        if (json_key_content !== undefined) { // Only update if new content is provided
          updateData.json_key_content = json_key_content || null;
        }
      } else { // If switching from or already using public API
        updateData.project_id = null;
        updateData.location_id = null;
        updateData.json_key_content = null;
      }
      updateData.api_endpoint = null; // Clear custom endpoint for Gemini
    } else if (currentKey.provider === 'custom_endpoint') {
      updateData.api_endpoint = api_endpoint || null;
      updateData.project_id = null;
      updateData.location_id = null;
      updateData.json_key_content = null;
      updateData.use_vertex_ai = false;
    } else { // Other providers
      updateData.project_id = null;
      updateData.location_id = null;
      updateData.json_key_content = null;
      updateData.use_vertex_ai = false;
      updateData.api_endpoint = null;
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