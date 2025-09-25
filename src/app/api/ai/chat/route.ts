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
    const { messages, selectedKeyId } = await req.json(); // Expect selectedKeyId

    if (!selectedKeyId) {
      return NextResponse.json({ message: 'ID de clave de API no proporcionado.' }, { status: 400 });
    }

    // Fetch active API key details for the user and the given key ID
    const { data: keyDetails, error: keyError } = await supabase
      .from('user_api_keys')
      .select('api_key, project_id, location_id, use_vertex_ai, model_name')
      .eq('id', selectedKeyId) // Filter by ID
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .single();

    if (keyError || !keyDetails) {
      throw new Error('No se encontró una API key activa con el ID proporcionado para este usuario. Por favor, verifica la Gestión de API Keys.');
    }

    let genAI: GoogleGenAI;
    let finalModel = keyDetails.model_name; // Use model_name from keyDetails

    if (keyDetails.use_vertex_ai) {
      const project = keyDetails.project_id;
      const location = keyDetails.location_id;
      if (!project || !location) {
        throw new Error('Project ID y Location ID son requeridos para Vertex AI. Por favor, configúralos en la Gestión de API Keys.');
      }
      genAI = new GoogleGenAI({ vertexai: true, project, location });
      if (!finalModel) {
        throw new Error('Nombre de modelo no configurado para Vertex AI. Por favor, selecciona un modelo en la Gestión de API Keys.');
      }
    } else {
      const apiKey = keyDetails.api_key;
      if (!apiKey) {
        throw new Error('API Key no encontrada para Google Gemini. Por favor, configúrala en la Gestión de API Keys.');
      }
      genAI = new GoogleGenAI({ apiKey });
      // For public API, if model_name is not set in keyDetails, use a default or require it.
      // For now, let's assume the frontend sends a valid model string if not Vertex AI.
      // Or, we can default to a public model if keyDetails.model_name is null.
      // Let's stick to `finalModel` from `keyDetails.model_name` for consistency.
      if (!finalModel) {
        // Fallback for older keys or if model_name wasn't explicitly set for public API
        finalModel = 'gemini-1.5-flash-latest'; // A reasonable default
      }
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
          } else if (part.type === 'code') { // Convert code blocks to text for Gemini
            const codePart = part as { language?: string; filename?: string; code?: string };
            const lang = codePart.language ? `(${codePart.language})` : '';
            const filename = codePart.filename ? `[${codePart.filename}]` : '';
            parts.push({ text: `\`\`\`${lang}${filename}\n${codePart.code || ''}\n\`\`\`` });
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

    const result = await genAI.models.generateContent({ model: finalModel, contents }); // Use finalModel
    const text = result.text; // Access .text as a property

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