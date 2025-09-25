export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { GoogleGenAI, Part } from '@google/genai';

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

    const useVertexAI = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'True';
    let genAI: GoogleGenAI;

    if (useVertexAI) {
      const project = process.env.GOOGLE_CLOUD_PROJECT;
      const location = process.env.GOOGLE_CLOUD_LOCATION;
      if (!project || !location) {
        throw new Error('Variables de entorno GOOGLE_CLOUD_PROJECT y GOOGLE_CLOUD_LOCATION son requeridas para Vertex AI.');
      }
      genAI = new GoogleGenAI({ vertexai: true, project, location });
    } else {
      // Fetch active API keys for the user and provider (only if not using Vertex AI)
      const { data: keys, error: keyError } = await supabase
        .from('user_api_keys')
        .select('api_key')
        .eq('user_id', session.user.id)
        .eq('provider', 'google_gemini')
        .eq('is_active', true);

      if (keyError || !keys || keys.length === 0) {
        throw new Error('No se encontró una API key de Google Gemini activa. Por favor, añade una en la Gestión de API Keys.');
      }
      const apiKey = keys[0].api_key;
      genAI = new GoogleGenAI({ apiKey });
    }

    // Helper to convert our message format to Gemini's format
    const convertToGeminiParts = (content: any): Part[] => {
      const parts: Part[] = [];
      if (typeof content === 'string') {
        parts.push({ text: content });
      } else if (Array.isArray(content)) {
        for (const part of content) {
          if (part.type === 'text') {
            parts.push({ text: part.text });
          } else if (part.type === 'image_url') {
            const url = part.image_url.url;
            const match = url.match(/^data:(image\/\w+);base64,(.*)$/);
            if (!match) {
              console.warn("Skipping invalid image data URL format for Gemini:", url.substring(0, 50) + '...');
              parts.push({ text: "[Unsupported Image]" });
            } else {
              const mimeType = match[1];
              const data = match[2];
              parts.push({ inlineData: { mimeType, data } });
            }
          }
        }
      }
      return parts;
    };

    // Convert messages to Gemini's `contents` format
    const contents = messages.map((msg: any) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: convertToGeminiParts(msg.content),
    }));

    const result = await genAI.models.generateContent({ model, contents });
    const text = result.text; // FIX: Access .text as a property

    return NextResponse.json({ message: { content: text } });

  } catch (error: any) {
    console.error('[API /ai/chat] Error:', error);
    
    let userFriendlyMessage = 'Ocurrió un error inesperado con la API de Gemini.';
    const errorMessage = error.message || '';

    if (errorMessage.includes('503') || errorMessage.toLowerCase().includes('overloaded')) {
      userFriendlyMessage = 'El modelo de IA de Google está sobrecargado en este momento. Por favor, intenta de nuevo en unos minutos o cambia a otro modelo.';
    } else if (errorMessage.toLowerCase().includes('api key not valid')) {
      userFriendlyMessage = 'Tu API Key de Google Gemini no es válida. Por favor, verifica que sea correcta en la Gestión de API Keys.';
    } else if (errorMessage.includes('GOOGLE_CLOUD_PROJECT') || errorMessage.includes('GOOGLE_CLOUD_LOCATION')) {
      userFriendlyMessage = `Error de configuración de Vertex AI: ${errorMessage}`;
    }
    else {
      userFriendlyMessage = `Error en la API de Gemini: ${errorMessage}`;
    }

    return NextResponse.json({ message: userFriendlyMessage }, { status: 500 });
  }
}