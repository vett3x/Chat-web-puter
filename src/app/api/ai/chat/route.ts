export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function getSupabaseClient() {
  const cookieStore = cookies() as any;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
      },
    }
  );
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  try {
    const { messages, apiKeyId } = await req.json();

    if (!apiKeyId) {
      throw new Error('No se ha seleccionado una configuración de API Key.');
    }

    // Fetch the selected API key configuration from the database
    const { data: apiKeyConfig, error: keyError } = await supabase
      .from('user_api_keys')
      .select('api_endpoint, api_key, model_name')
      .eq('id', apiKeyId)
      .eq('user_id', session.user.id)
      .single();

    if (keyError || !apiKeyConfig) {
      throw new Error('La configuración de API Key seleccionada no es válida o no se encontró.');
    }

    const { api_endpoint, api_key, model_name } = apiKeyConfig;

    // Prepare the request for an OpenAI-compatible API
    const response = await fetch(api_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api_key}`,
      },
      body: JSON.stringify({
        model: model_name,
        messages: messages, // Assuming messages are already in the correct format
        stream: false, // For simplicity, we are not using streaming responses for now
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[API Proxy Error] Status: ${response.status}, Body: ${errorBody}`);
      throw new Error(`Error de la API externa: ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || 'No se recibió contenido en la respuesta.';

    return NextResponse.json({ message: { content } });

  } catch (error: any) {
    console.error('[API /ai/chat] Error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}