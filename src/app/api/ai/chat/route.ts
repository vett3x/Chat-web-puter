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

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  try {
    const { messages, model } = await req.json();

    // Fetch active API keys for the user and provider
    const { data: keys, error: keyError } = await supabase
      .from('user_api_keys')
      .select('api_key')
      .eq('user_id', session.user.id)
      .eq('provider', 'google_gemini')
      .eq('is_active', true);

    if (keyError || !keys || keys.length === 0) {
      throw new Error('No se encontró una API key de Google Gemini activa. Por favor, añade una en la Gestión de API Keys.');
    }

    // For now, use the first available key.
    const apiKey = keys[0].api_key;
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model });

    // Convert messages to Gemini format
    const history = messages.slice(0, -1).map((msg: any) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));
    const lastMessage = messages[messages.length - 1];

    const chat = geminiModel.startChat({ history });
    const result = await chat.sendMessage(lastMessage.content);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ message: { content: text } });

  } catch (error: any) {
    console.error('[API /ai/chat] Error:', error);
    // Provide a more specific error message if available
    const errorMessage = error.details || error.message || 'Error desconocido en la API de IA.';
    return NextResponse.json({ message: `Error en la API de Gemini: ${errorMessage}` }, { status: 500 });
  }
}