export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

async function handleCustomOpenAI(config: any, messages: any[]) {
  const { api_endpoint, api_key, model_name } = config;
  const response = await fetch(api_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${api_key}`,
    },
    body: JSON.stringify({
      model: model_name,
      messages: messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Error de la API externa: ${response.statusText} - ${errorBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No se recibió contenido en la respuesta.';
}

async function handleGoogleGemini(config: any, messages: any[]) {
  const { api_key, model_name } = config;
  if (!model_name) {
    throw new Error('El nombre del modelo de Gemini es requerido.');
  }
  const genAI = new GoogleGenerativeAI(api_key);
  const model = genAI.getGenerativeModel({ model: model_name });

  // Convert OpenAI message format to Gemini format
  const geminiHistory = messages.slice(0, -1).map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));
  const lastMessage = messages[messages.length - 1];

  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessage(lastMessage.content);
  const response = await result.response;
  return response.text();
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  try {
    const { messages, apiKeyId } = await req.json();
    if (!apiKeyId) throw new Error('No se ha seleccionado una configuración de API Key.');

    const { data: apiKeyConfig, error: keyError } = await supabase
      .from('user_api_keys')
      .select('*')
      .eq('id', apiKeyId)
      .eq('user_id', session.user.id)
      .single();

    if (keyError || !apiKeyConfig) {
      throw new Error('La configuración de API Key seleccionada no es válida o no se encontró.');
    }

    let content = '';
    switch (apiKeyConfig.provider) {
      case 'custom_openai':
        content = await handleCustomOpenAI(apiKeyConfig, messages);
        break;
      case 'google_gemini':
        content = await handleGoogleGemini(apiKeyConfig, messages);
        break;
      default:
        throw new Error(`Proveedor de API no soportado: ${apiKeyConfig.provider}`);
    }

    return NextResponse.json({ message: { content } });

  } catch (error: any) {
    console.error('[API /ai/chat] Error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}