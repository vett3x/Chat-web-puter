export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { SUPERUSER_EMAILS, PERMISSION_KEYS, UserPermissions } from '@/lib/constants'; // Importación actualizada
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAuth } from 'google-auth-library';

// Define unified part types for internal API handling
interface TextPart { type: 'text'; text: string; }
interface ImagePart { type: 'image_url'; image_url: { url: string }; }
interface CodePart { type: 'code'; language?: string; filename?: string; code?: string; }
type MessageContentPart = TextPart | ImagePart | CodePart;

// Esquema para la creación/actualización de una API Key individual
const apiKeySchema = z.object({
  id: z.string().optional(), // Optional for POST, required for PUT
  group_id: z.string().uuid().optional().nullable(), // NEW: Optional group_id
  provider: z.string().min(1),
  api_key: z.string().trim().optional().or(z.literal('')),
  nickname: z.string().trim().optional().or(z.literal('')),
  project_id: z.string().trim().optional().or(z.literal('')),
  location_id: z.string().trim().optional().or(z.literal('')),
  use_vertex_ai: z.boolean().optional(),
  model_name: z.string().trim().optional().or(z.literal('')),
  json_key_content: z.string().optional(),
  api_endpoint: z.string().trim().url({ message: 'URL de endpoint inválida.' }).optional().or(z.literal('')),
  is_global: z.boolean().optional(),
  status: z.enum(['active', 'failed', 'blocked']).optional(), // NEW: Allow status update
  status_message: z.string().optional().nullable(), // NEW: Allow status message update
}).superRefine((data, ctx) => {
  if (data.provider === 'google_gemini') {
    if (data.use_vertex_ai) {
      if (!data.model_name || data.model_name === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Debes seleccionar un modelo para usar Vertex AI.', path: ['model_name'] });
      }
      if (!data.project_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Project ID es requerido para usar Vertex AI.', path: ['project_id'] });
      }
      if (!data.location_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Location ID es requerido para usar Vertex AI.', path: ['location_id'] });
      }
    } else {
      if (!data.model_name || data.model_name === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Debes seleccionar un modelo para la API pública de Gemini.', path: ['model_name'] });
      }
    }
  } else if (data.provider === 'custom_endpoint') {
    if (!data.api_endpoint || data.api_endpoint === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El link del endpoint es requerido para un endpoint personalizado.', path: ['api_endpoint'] });
    }
    if (!data.model_name || data.model_name === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El ID del modelo es requerido para un endpoint personalizado.', path: ['model_name'] });
    }
    if (!data.nickname || data.nickname === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El apodo es obligatorio para un endpoint personalizado.', path: ['nickname'] });
    }
  }
});

// Esquema para la creación/actualización de un grupo de API Keys
const aiKeyGroupSchema = z.object({
  id: z.string().uuid().optional(), // Optional for POST, required for PUT
  name: z.string().min(1, { message: 'El nombre del grupo es requerido.' }),
  provider: z.string().min(1),
  model_name: z.string().trim().optional().or(z.literal('')),
  is_global: z.boolean().optional(),
});

// Helper function to get the session and user role
async function getSessionAndRole(): Promise<{ session: any; userRole: 'user' | 'admin' | 'super_admin' | null }> {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) {},
        remove(name: string, options: CookieOptions) {},
      },
    }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { session: null, userRole: null };

  if (session.user.email && SUPERUSER_EMAILS.includes(session.user.email)) {
    return { session, userRole: 'super_admin' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  const userRole = profile?.role as 'user' | 'admin' | 'super_admin' | null;
  return { session, userRole };
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testApiKey(keyDetails: any) {
  try {
    if (keyDetails.provider === 'google_gemini') {
      if (keyDetails.use_vertex_ai) {
        if (!keyDetails.json_key_content || !keyDetails.project_id || !keyDetails.location_id) {
          throw new Error('Configuración de Vertex AI incompleta.');
        }
        const auth = new GoogleAuth({
          credentials: JSON.parse(keyDetails.json_key_content),
          scopes: 'https://www.googleapis.com/auth/cloud-platform',
        });
        const client = await auth.getClient();
        const accessToken = (await client.getAccessToken()).token;
        if (!accessToken) throw new Error('No se pudo obtener el token de acceso de Vertex AI.');
        const response = await fetch(`https://${keyDetails.location_id}-aiplatform.googleapis.com/v1/projects/${keyDetails.project_id}/locations`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Error de API de Vertex AI: ${errorData.error?.message || response.statusText}`);
        }
      } else {
        if (!keyDetails.api_key) throw new Error('API Key no proporcionada.');
        const genAI = new GoogleGenerativeAI(keyDetails.api_key);
        await genAI.getGenerativeModel({ model: keyDetails.model_name || 'gemini-pro' });
      }
    } else if (keyDetails.provider === 'custom_endpoint') {
      if (!keyDetails.api_endpoint || !keyDetails.model_name) throw new Error('Configuración de endpoint personalizado incompleta.');
      const response = await fetch(keyDetails.api_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(keyDetails.api_key && { 'Authorization': `Bearer ${keyDetails.api_key}` }),
        },
        body: JSON.stringify({ model: keyDetails.model_name, messages: [{ role: 'user', content: 'test' }], max_tokens: 1 }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`El endpoint personalizado devolvió un error ${response.status}: ${errorText.substring(0, 100)}`);
      }
    } else {
      if (!keyDetails.api_key) throw new Error('API Key no proporcionada.');
    }
    await supabaseAdmin.from('user_api_keys').update({ status: 'active', status_message: null }).eq('id', keyDetails.id);
  } catch (error: any) {
    await supabaseAdmin.from('user_api_keys').update({ status: 'failed', status_message: error.message }).eq('id', keyDetails.id);
  }
}

export async function GET(req: NextRequest) {
  const { session, userRole } = await getSessionAndRole();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  try {
    let groupsQuery = supabaseAdmin
      .from('ai_key_groups')
      .select('id, user_id, name, provider, model_name, is_global, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (userRole !== 'super_admin') {
      groupsQuery = groupsQuery.or(`user_id.eq.${session.user.id},is_global.eq.true`);
    }
    const { data: aiKeyGroups, error: groupsError } = await groupsQuery;
    if (groupsError) throw new Error(groupsError.message);

    let keysQuery = supabaseAdmin
      .from('user_api_keys')
      .select('id, user_id, nickname, api_key, is_active, created_at, last_used_at, usage_count, api_endpoint, model_name, provider, project_id, location_id, use_vertex_ai, json_key_content, is_global, group_id, status, status_message')
      .order('created_at', { ascending: false });

    if (userRole !== 'super_admin') {
      const accessibleGroupIds = aiKeyGroups.map(g => g.id);
      keysQuery = keysQuery.or(`user_id.eq.${session.user.id},is_global.eq.true,group_id.in.(${accessibleGroupIds.join(',')})`);
    }
    const { data: apiKeys, error: keysError } = await keysQuery;
    if (keysError) throw new Error(keysError.message);

    const maskedApiKeys = apiKeys.map(key => ({
      ...key,
      api_key: key.api_key ? `${key.api_key.substring(0, 4)}...${key.api_key.substring(key.api_key.length - 4)}` : null,
      json_key_content: key.json_key_content ? 'Subido' : null,
    }));

    const groupsWithKeys = aiKeyGroups.map(group => ({
      ...group,
      api_keys: maskedApiKeys.filter(key => key.group_id === group.id),
    }));

    const standaloneApiKeys = maskedApiKeys.filter(key => !key.group_id);

    return NextResponse.json({ aiKeyGroups: groupsWithKeys, apiKeys: standaloneApiKeys });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { session, userRole } = await getSessionAndRole();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { group_id, is_global: isKeyGlobal, ...keyData } = apiKeySchema.parse(body);

    const finalIsKeyGlobal = isKeyGlobal !== undefined ? isKeyGlobal : false;
    if (finalIsKeyGlobal && userRole !== 'super_admin') {
      return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden crear claves globales.' }, { status: 403 });
    }

    let targetGroupId = group_id;
    let groupIsGlobal = finalIsKeyGlobal;

    if (targetGroupId) {
      const { data: existingGroup, error: groupError } = await supabaseAdmin.from('ai_key_groups').select('id, is_global, user_id').eq('id', targetGroupId).single();
      if (groupError || !existingGroup) throw new Error('Grupo de claves no encontrado o acceso denegado.');
      const isGroupOwner = existingGroup.user_id === session.user.id;
      if (!existingGroup.is_global && !isGroupOwner && userRole !== 'super_admin') throw new Error('Acceso denegado. No tienes permiso para añadir claves a este grupo.');
      if (existingGroup.is_global && userRole !== 'super_admin') throw new Error('Acceso denegado. Solo los Super Admins pueden añadir claves a grupos globales.');
      groupIsGlobal = existingGroup.is_global;
    } else if (keyData.provider === 'google_gemini') {
      const newGroupName = keyData.nickname || `${keyData.model_name || 'Google Gemini'} Group`;
      const { data: newGroup, error: newGroupError } = await supabaseAdmin.from('ai_key_groups').insert({ user_id: finalIsKeyGlobal ? null : session.user.id, name: newGroupName, provider: keyData.provider, model_name: keyData.model_name, is_global: finalIsKeyGlobal }).select('id, is_global').single();
      if (newGroupError) throw new Error(`Error al crear el grupo de claves: ${newGroupError.message}`);
      targetGroupId = newGroup.id;
      groupIsGlobal = newGroup.is_global;
    }

    const insertData: any = {
      user_id: finalIsKeyGlobal || groupIsGlobal ? null : session.user.id,
      group_id: targetGroupId,
      provider: keyData.provider,
      nickname: keyData.nickname || null,
      model_name: keyData.model_name || null,
      is_active: true,
      is_global: finalIsKeyGlobal || groupIsGlobal,
      status: 'active',
      status_message: null,
    };

    if (keyData.provider === 'google_gemini') {
      insertData.use_vertex_ai = keyData.use_vertex_ai || false;
      if (keyData.use_vertex_ai) {
        insertData.project_id = keyData.project_id || null;
        insertData.location_id = keyData.location_id || null;
        insertData.json_key_content = keyData.json_key_content || null;
        insertData.api_key = null;
      } else {
        insertData.api_key = keyData.api_key || null;
      }
    } else if (keyData.provider === 'custom_endpoint') {
      insertData.api_endpoint = keyData.api_endpoint || null;
      insertData.api_key = keyData.api_key || null;
      insertData.use_vertex_ai = false;
    } else {
      insertData.api_key = keyData.api_key || null;
      insertData.use_vertex_ai = false;
    }

    const { data, error } = await supabaseAdmin.from('user_api_keys').insert(insertData).select().single();
    if (error) throw error;

    // Don't await, run in background
    testApiKey(data);

    return NextResponse.json({ message: 'API Key guardada y en proceso de verificación.', key: data }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { session, userRole } = await getSessionAndRole();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, group_id, is_global: isKeyGlobal, status, status_message, ...keyData } = apiKeySchema.parse(body);

    if (!id) {
      return NextResponse.json({ message: 'ID de clave es requerido para actualizar.' }, { status: 400 });
    }

    const { data: currentKey, error: currentKeyError } = await supabaseAdmin.from('user_api_keys').select('provider, use_vertex_ai, user_id, is_global, group_id').eq('id', id).single();
    if (currentKeyError || !currentKey) throw new Error('Clave no encontrada para verificar el estado.');

    const isOwner = currentKey.user_id === session.user.id;
    const isGroupOwner = currentKey.group_id ? (await supabaseAdmin.from('ai_key_groups').select('user_id').eq('id', currentKey.group_id).single())?.data?.user_id === session.user.id : false;

    if (currentKey.is_global && userRole !== 'super_admin') return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden modificar claves globales.' }, { status: 403 });
    if (!currentKey.is_global && !isOwner && !isGroupOwner && userRole !== 'super_admin') return NextResponse.json({ message: 'Acceso denegado. No tienes permiso para modificar esta clave.' }, { status: 403 });
    if (isKeyGlobal !== undefined && isKeyGlobal !== currentKey.is_global && userRole !== 'super_admin') return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden cambiar el estado global de una clave.' }, { status: 403 });
    if (group_id !== undefined && group_id !== currentKey.group_id && userRole !== 'super_admin') return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden cambiar el grupo de una clave.' }, { status: 403 });
    if (status && (status === 'blocked' || status === 'failed') && userRole !== 'super_admin') return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden establecer el estado de una clave como fallida o bloqueada.' }, { status: 403 });

    const updateData: any = {
      nickname: keyData.nickname || null,
      model_name: keyData.model_name || null,
      is_global: isKeyGlobal !== undefined ? isKeyGlobal : currentKey.is_global,
      user_id: (isKeyGlobal || currentKey.is_global) ? null : session.user.id,
      group_id: group_id !== undefined ? group_id : currentKey.group_id,
      status: status !== undefined ? status : 'active',
      status_message: status_message !== undefined ? status_message : null,
    };
    
    if (keyData.api_key !== undefined && keyData.api_key !== '') {
      updateData.api_key = keyData.api_key;
    }

    if (currentKey.provider === 'google_gemini') {
      updateData.use_vertex_ai = keyData.use_vertex_ai;
      if (keyData.use_vertex_ai) {
        updateData.api_key = null;
        updateData.project_id = keyData.project_id || null;
        updateData.location_id = keyData.location_id || null;
        if (keyData.json_key_content !== undefined) {
          updateData.json_key_content = keyData.json_key_content || null;
        }
      } else {
        updateData.project_id = null;
        updateData.location_id = null;
        updateData.json_key_content = null;
      }
      updateData.api_endpoint = null;
    } else if (currentKey.provider === 'custom_endpoint') {
      updateData.api_endpoint = keyData.api_endpoint || null;
      updateData.project_id = null;
      updateData.location_id = null;
      updateData.json_key_content = null;
      updateData.use_vertex_ai = false;
    } else {
      updateData.project_id = null;
      updateData.location_id = null;
      updateData.json_key_content = null;
      updateData.use_vertex_ai = false;
      updateData.api_endpoint = null;
    }

    const { data, error } = await supabaseAdmin.from('user_api_keys').update(updateData).eq('id', id).select().single();
    if (error) throw error;

    // Don't await, run in background
    testApiKey(data);

    return NextResponse.json({ message: 'API Key actualizada y en proceso de verificación.', key: data });
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Error de validación', errors: error.errors }, { status: 400 });
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { session, userRole } = await getSessionAndRole();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const type = searchParams.get('type'); // 'key' or 'group'

  if (!id) {
    return NextResponse.json({ message: 'ID no proporcionado.' }, { status: 400 });
  }

  try {
    if (type === 'group') {
      const { data: currentGroup, error: groupError } = await supabaseAdmin.from('ai_key_groups').select('user_id, is_global').eq('id', id).single();
      if (groupError || !currentGroup) throw new Error('Grupo no encontrado para verificar el estado.');
      const isGroupOwner = currentGroup.user_id === session.user.id;
      if (currentGroup.is_global && userRole !== 'super_admin') return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden eliminar grupos globales.' }, { status: 403 });
      if (!currentGroup.is_global && !isGroupOwner && userRole !== 'super_admin') return NextResponse.json({ message: 'Acceso denegado. No tienes permiso para eliminar este grupo.' }, { status: 403 });
      const { error } = await supabaseAdmin.from('ai_key_groups').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ message: 'Grupo de API Keys eliminado correctamente.' });
    } else {
      const { data: currentKey, error: keyError } = await supabaseAdmin.from('user_api_keys').select('user_id, is_global, group_id').eq('id', id).single();
      if (keyError || !currentKey) throw new Error('Clave no encontrada para verificar el estado.');
      const isOwner = currentKey.user_id === session.user.id;
      const isGroupOwner = currentKey.group_id ? (await supabaseAdmin.from('ai_key_groups').select('user_id').eq('id', currentKey.group_id).single())?.data?.user_id === session.user.id : false;
      if (currentKey.is_global && userRole !== 'super_admin') return NextResponse.json({ message: 'Acceso denegado. Solo los Super Admins pueden eliminar claves globales.' }, { status: 403 });
      if (!currentKey.is_global && !isOwner && !isGroupOwner && userRole !== 'super_admin') return NextResponse.json({ message: 'Acceso denegado. No tienes permiso para eliminar esta clave.' }, { status: 403 });
      const { error } = await supabaseAdmin.from('user_api_keys').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ message: 'API Key eliminada correctamente.' });
    }
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}