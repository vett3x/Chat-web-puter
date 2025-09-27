export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { SUPERUSER_EMAILS, UserPermissions, PERMISSION_KEYS } from '@/lib/constants'; // Importación actualizada
import { createClient } from '@supabase/supabase-js';

const apiKeySchema = z.object({
  id: z.string().optional(), // Optional for POST, required for PUT
  provider: z.string().min(1),
  api_key: z.string().optional(), // Make optional
  nickname: z.string().optional(),
  project_id: z.string().optional(),
  location_id: z.string().optional(),
  use_vertex_ai: z.boolean().optional(),
  model_name: z.string().optional(), // This needs to be conditional
  json_key_content: z.string().optional(), // New: for Vertex AI JSON key content
  api_endpoint: z.string().url({ message: 'URL de endpoint inválida.' }).optional(), // New: for custom endpoint
  is_global: z.boolean().optional(), // NEW: Add is_global to schema
}).superRefine((data, ctx) => {
  if (data.provider === 'google_gemini') {
    if (data.use_vertex_ai) {
      if (!data.model_name || data.model_name === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Debes seleccionar un modelo para usar Vertex AI.',
          path: ['model_name'],
        });
      }
      if (!data.project_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Project ID es requerido para usar Vertex AI.',
          path: ['project_id'],
        });
      }
      if (!data.location_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Location ID es requerido para usar Vertex AI.',
          path: ['location_id'],
        });
      }
    } else { // Public API
      if (!data.model_name || data.model_name === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Debes seleccionar un modelo para la API pública de Gemini.',
          path: ['model_name'],
        });
      }
      // REMOVED: API key validation for adding new keys from here. It's now handled manually in onSubmit.
    }
  } else if (data.provider === 'custom_endpoint') { // New validation for custom_endpoint
    if (!data.api_endpoint || data.api_endpoint === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El link del endpoint es requerido para un endpoint personalizado.',
        path: ['api_endpoint'],
      });
    }
    // REMOVED: API key validation for adding new keys from here. It's now handled manually in onSubmit.
    if (!data.model_name || data.model_name === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El ID del modelo es requerido para un endpoint personalizado.',
        path: ['model_name'],
      });
    }
    if (!data.nickname || data.nickname === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El apodo es obligatorio para un endpoint personalizado.',
        path: ['nickname'],
      });
    }
  }
});

const updateApiKeySchema = z.object({
  id: z.string().min(1, { message: 'ID de clave es requerido para actualizar.' }),
  provider: z.string().min(1),
  api_key: z.string().optional(), // API Key is optional for updates
  nickname: z.string().optional(),
  project_id: z.string().optional(),
  location_id: z.string().optional(),
  use_vertex_ai: z.boolean().optional(),
  model_name: z.string().optional(),
  json_key_file: z.any().optional(),
  json_key_content: z.string().optional(),
  api_endpoint: z.string().url({ message: 'URL de endpoint inválida.' }).optional(), // New: for custom endpoint
  is_global: z.boolean().optional(), // NEW: Add is_global to schema
}).superRefine((data, ctx) => {
  // For updates, API key is only required if it's explicitly provided and not empty.
  // If it's empty, it means the user doesn't want to change the existing key.
  // The backend will handle not updating it if the field is missing from the payload.

  if (data.provider === 'google_gemini') {
    if (data.use_vertex_ai) {
      if (!data.model_name || data.model_name === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Debes seleccionar un modelo para usar Vertex AI.',
          path: ['model_name'],
        });
      }
      if (!data.project_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Project ID es requerido para usar Vertex AI.',
          path: ['project_id'],
        });
      }
      if (!data.location_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Location ID es requerido para usar Vertex AI.',
          path: ['location_id'],
        });
      }
    } else { // Public API
      if (!data.model_name || data.model_name === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Debes seleccionar un modelo para la API pública de Gemini.',
          path: ['model_name'],
        });
      }
      // API Key is optional for update if not changing
      // if (!data.api_key || data.api_key === '') {
      //   ctx.addIssue({
      //     code: z.ZodIssueCode.custom,
      //     message: 'API Key es requerida para la API pública de Gemini.',
      //     path: ['api_key'],
      //   });
      // }
    }
  } else if (data.provider === 'custom_endpoint') { // New validation for custom_endpoint
    if (!data.api_endpoint || data.api_endpoint === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El link del endpoint es requerido para un endpoint personalizado.',
        path: ['api_endpoint'],
      });
    }
    // API Key is optional for update if not changing
    // if (!data.api_key || data.api_key === '') {
    //   ctx.addIssue({
    //     code: z.ZodIssueCode.custom,
    //     message: 'La API Key es requerida para un endpoint personalizado.',
    //     path: ['api_key'],
    //   });
    // }
    if (!data.model_name || data.model_name === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El ID del modelo es requerido para un endpoint personalizado.',
        path: ['model_name'],
      });
    }
    if (!data.nickname || data.nickname === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El apodo es obligatorio para un endpoint personalizado.',
        path: ['nickname'],
      });
    }
  }
});

// Helper function to get the session and user role
async function getSessionAndRole(): Promise<{ session: any; userRole: 'user' | 'admin' | 'super_admin' | null; userPermissions: UserPermissions }> {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {},
        remove(name: string, options: CookieOptions) {},
      },
    }
  );
  const { data: { session } } = await supabase.auth.getSession();

  let userRole: 'user' | 'admin' | 'super_admin' | null = null;
  let userPermissions: UserPermissions = {};

  if (session?.user?.id) {
    // First, determine the role, prioritizing SUPERUSER_EMAILS
    if (session.user.email && SUPERUSER_EMAILS.includes(session.user.email)) {
      userRole = 'super_admin';
    } else {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role') // Only need role for initial determination
        .eq('id', session.user.id)
        .single();
      if (profile) {
        userRole = profile.role as 'user' | 'admin' | 'super_admin';
      } else {
        userRole = 'user'; // Default to user if no profile found and not superuser email
      }
    }

    // Then, fetch permissions from profile, or set all if super_admin
    if (userRole === 'super_admin') {
      for (const key of Object.values(PERMISSION_KEYS)) {
        userPermissions[key] = true;
      }
    } else {
      const { data: profilePermissions, error: permissionsError } = await supabase
        .from('profiles')
        .select('permissions')
        .eq('id', session.user.id)
        .single();
      if (profilePermissions) {
        userPermissions = profilePermissions.permissions || {};
      } else {
        // Default permissions for non-super-admin if profile fetch failed
        userPermissions = {
          [PERMISSION_KEYS.CAN_CREATE_SERVER]: false,
          [PERMISSION_KEYS.CAN_MANAGE_DOCKER_CONTAINERS]: false,
          [PERMISSION_KEYS.CAN_MANAGE_CLOUDFLARE_DOMAINS]: false,
          [PERMISSION_KEYS.CAN_MANAGE_CLOUDFLARE_TUNNELS]: false,
        };
      }
    }
  }
  return { session, userRole, userPermissions };
}

export async function GET(req: NextRequest) {
  const { session, userRole } = await getSessionAndRole();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let query = supabaseAdmin
    .from('user_api_keys')
    .select('id, provider, api_key, is_active, created_at, nickname, project_id, location_id, use_vertex_ai, model_name, json_key_content, api_endpoint, is_global')
    .order('created_at', { ascending: false });

  // All roles (user, admin, super_admin) should see their own keys OR global keys
  if (userRole === 'user' || userRole === 'admin') {
    query = query.or(`user_id.eq.${session.user.id},is_global.eq.true`);
  }
  // If userRole is 'super_admin', no additional filter is applied, so they see all.

  const { data, error } = await query;

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
  const { session, userRole } = await getSessionAndRole();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const body = await req.json();
    const { provider, api_key, nickname, project_id, location_id, use_vertex_ai, model_name, json_key_content, api_endpoint, is_global } = apiKeySchema.parse(body); // NEW: Parse is_global

    if (is_global && userRole !== 'super_admin') {
      return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden crear claves globales.' }, { status: 403 });
    }

    const insertData: any = {
      user_id: is_global ? null : session.user.id, // NEW: Set user_id to null if global
      provider,
      nickname: nickname || null,
      model_name: model_name || null,
      is_active: true, // Default to active
      is_global: is_global || false, // NEW: Set is_global
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

    const { data, error } = await supabaseAdmin
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
  const { session, userRole } = await getSessionAndRole();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const body = await req.json();
    const { id, provider, api_key, nickname, project_id, location_id, use_vertex_ai, model_name, json_key_content, api_endpoint, is_global } = updateApiKeySchema.parse(body); // NEW: Parse is_global

    // Fetch current key details to determine existing provider, use_vertex_ai status, user_id, and is_global
    const { data: currentKey, error: currentKeyError } = await supabaseAdmin
      .from('user_api_keys')
      .select('provider, use_vertex_ai, user_id, is_global') // NEW: Select user_id and is_global
      .eq('id', id)
      .single();

    if (currentKeyError || !currentKey) throw new Error('Clave no encontrada para verificar el estado.');

    // Authorization checks
    if (currentKey.is_global && userRole !== 'super_admin') {
      return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden modificar claves globales.' }, { status: 403 });
    }
    if (!currentKey.is_global && currentKey.user_id !== session.user.id && userRole !== 'super_admin') {
      return NextResponse.json({ message: 'Acceso denegado. No tienes permiso para modificar esta clave.' }, { status: 403 });
    }
    if (is_global !== undefined && is_global !== currentKey.is_global && userRole !== 'super_admin') {
      return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden cambiar el estado global de una clave.' }, { status: 403 });
    }

    const updateData: any = {
      nickname: nickname || null,
      model_name: model_name || null,
      is_global: is_global !== undefined ? is_global : currentKey.is_global, // NEW: Update is_global if provided, else keep current
      user_id: is_global ? null : currentKey.user_id, // NEW: Set user_id to null if becoming global, otherwise keep current
    };
    
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

    const { data, error } = await supabaseAdmin
      .from('user_api_keys')
      .update(updateData)
      .eq('id', id)
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
  const { session, userRole } = await getSessionAndRole();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'ID de la clave no proporcionado.' }, { status: 400 });
  }

  // Fetch current key details to check its is_global status and user_id
  const { data: currentKey, error: currentKeyError } = await supabaseAdmin
    .from('user_api_keys')
    .select('user_id, is_global')
    .eq('id', id)
    .single();

  if (currentKeyError || !currentKey) throw new Error('Clave no encontrada para verificar el estado.');

  // Authorization checks
  if (currentKey.is_global && userRole !== 'super_admin') {
    return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden eliminar claves globales.' }, { status: 403 });
  }
  if (!currentKey.is_global && currentKey.user_id !== session.user.id && userRole !== 'super_admin') {
    return NextResponse.json({ message: 'Acceso denegado. No tienes permiso para eliminar esta clave.' }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from('user_api_keys')
    .delete()
    .eq('id', id); // Removed user_id filter here, as admin can delete global keys

  if (error) {
    console.error("[API /ai-keys DELETE] Error deleting key:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'API Key eliminada correctamente.' });
}