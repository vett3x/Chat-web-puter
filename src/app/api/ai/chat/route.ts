export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';

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

    // Helper to convert our message format to Gemini's format
    const convertToGeminiParts = (content: any) => {
      if (typeof content === 'string') {
        return [{ text: content }];
      }
      if (Array.isArray(content)) {
        return content.map(part => {
          if (part.type === 'text') {
            return { text: part.text };
          }
          if (part.type === 'image_url') {
            const url = part.image_url.url;
            const match = url.match(/^data:(image\/\w+);base64,(.*)$/);
            if (!match) {
              console.warn("Skipping invalid image data URL format for Gemini:", url.substring(0, 50) + '...');
              return { text: "[Unsupported Image]" };
            }
            const mimeType = match[1];
            const data = match[2];
            return { inlineData: { mimeType, data } };
          }
          // Ignore code blocks or other types not supported by Gemini API directly
          return null;
        }).filter((p): p is Part => p !== null); // Filter out nulls with a type guard
      }
      return [];
    };

    // Convert messages to Gemini format
    const history = messages.slice(0, -1).map((msg: any) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: convertToGeminiParts(msg.content),
    }));
    const lastMessage = messages[messages.length - 1];
    const lastMessageParts = convertToGeminiParts(lastMessage.content);

    const chat = geminiModel.startChat({ history });
    const result = await chat.sendMessage(lastMessageParts);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ message: { content: text } });

  } catch (error: any) {
    console.error('[API /ai/chat] Error:', error);
    
    let userFriendlyMessage = 'Ocurrió un error inesperado con la API de Gemini.';
    const errorMessage = error.message || '';

    if (errorMessage.includes('503') || errorMessage.toLowerCase().includes('overloaded')) {
      userFriendlyMessage = 'El modelo de IA de Google está sobrecargado en este momento. Por favor, intenta de nuevo en unos minutos o cambia a otro modelo.';
    } else if (errorMessage.toLowerCase().includes('api key not valid')) {
      userFriendlyMessage = 'Tu API Key de Google Gemini no es válida. Por favor, verifica que sea correcta en la Gestión de API Keys.';
    } else {
      // Keep a more generic but still helpful message for other errors
      userFriendlyMessage = `Error en la API de Gemini: ${errorMessage}`;
    }

    return NextResponse.json({ message: userFriendlyMessage }, { status: 500 });
  }
}