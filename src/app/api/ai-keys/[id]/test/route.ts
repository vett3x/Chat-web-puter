export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAuth } from 'google-auth-library';
import { SUPERUSER_EMAILS } from '@/lib/constants';

async function getSessionAndRole(): Promise<{ session: any; userRole: 'user' | 'admin' | 'super_admin' | null }> {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { session: null, userRole: null };

  if (session.user.email && SUPERUSER_EMAILS.includes(session.user.email)) {
    return { session, userRole: 'super_admin' };
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
  const userRole = profile?.role as 'user' | 'admin' | 'super_admin' | null;
  return { session, userRole };
}

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

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
        // A simple API call to check authentication
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
      // Placeholder for other providers
      if (!keyDetails.api_key) throw new Error('API Key no proporcionada.');
    }
    // If we reach here, the test is successful
    await supabaseAdmin.from('user_api_keys').update({ status: 'active', status_message: null }).eq('id', keyDetails.id);
    return { success: true };
  } catch (error: any) {
    await supabaseAdmin.from('user_api_keys').update({ status: 'failed', status_message: error.message }).eq('id', keyDetails.id);
    return { success: false, error: error.message };
  }
}

export async function POST(req: NextRequest, context: any) {
  const { session, userRole } = await getSessionAndRole();
  if (!session) return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });

  const keyId = context.params.id;
  if (!keyId) return NextResponse.json({ message: 'ID de clave no proporcionado.' }, { status: 400 });

  try {
    const { data: keyDetails, error: fetchError } = await supabaseAdmin
      .from('user_api_keys')
      .select('*')
      .eq('id', keyId)
      .single();

    if (fetchError || !keyDetails) throw new Error('Clave no encontrada.');

    const isOwner = keyDetails.user_id === session.user.id;
    if (!isOwner && userRole !== 'super_admin') {
      return NextResponse.json({ message: 'No tienes permiso para probar esta clave.' }, { status: 403 });
    }

    const result = await testApiKey(keyDetails);

    if (result.success) {
      return NextResponse.json({ message: 'Conexión exitosa.' });
    } else {
      return NextResponse.json({ message: `Falló la prueba de conexión: ${result.error}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error(`[API /ai-keys/test] Error:`, error);
    return NextResponse.json({ message: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}