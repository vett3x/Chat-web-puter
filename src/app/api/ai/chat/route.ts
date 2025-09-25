export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { GoogleGenerativeAI, Part } from '@google/generative-ai'; // Corrected import
import { GoogleAuth } from 'google-auth-library';
import { z } from 'zod'; // Import z for validation

// Define unified part types for internal API handling
interface TextPart { type: 'text'; text: string; }
interface ImagePart { type: 'image_url'; image_url: { url: string }; }
interface CodePart { type: 'code'; language?: string; filename?: string; code?: string; } // Added CodePart
type MessageContentPart = TextPart | ImagePart | CodePart; // Unified type for internal messages

// Define the schema for incoming messages from the client
const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.union([
    z.string(),
    z.array(z.union([
      z.object({ type: z.literal('text'), text: z.string() }),
      z.object({ type: z.literal('image_url'), image_url: z.object({ url: z.string() }) }),
      z.object({ type: z.literal('code'), language: z.string().optional(), filename: z.string().optional(), code: z.string().optional() }), // Added code part
    ]))
  ]),
});

const chatRequestSchema = z.object({
  messages: z.array(messageSchema),
  selectedKeyId: z.string().uuid(),
});

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

// Helper to convert internal content parts to Gemini API parts
const convertToGeminiParts = (content: string | MessageContentPart[]): Part[] => {
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
      } else if (part.type === 'code') {
        // Convert code blocks to text for Gemini API
        const codePart = part as CodePart;
        const lang = codePart.language || '';
        const filename = codePart.filename ? `:${codePart.filename}` : '';
        parts.push({ text: `\`\`\`${lang}${filename}\n${codePart.code || ''}\n\`\`\`` });
      }
    }
  }
  return parts;
};

// Helper to convert internal content parts to a string for custom endpoints
function messageContentToString(content: string | MessageContentPart[]): string {
  if (typeof content === 'string') {
    return content;
  }
  return content.map(part => {
    if (part.type === 'text') return part.text;
    if (part.type === 'code') return `\`\`\`${part.language || ''}${part.filename ? `:${part.filename}` : ''}\n${part.code || ''}\n\`\`\``;
    if (part.type === 'image_url') return `[Imagen: ${part.image_url.url.substring(0, 30)}...]`;
    return '';
  }).join('\n\n');
}


export async function POST(req: NextRequest) {
  const supabase = await getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { messages, selectedKeyId } = chatRequestSchema.parse(body);

    const { data: keyDetails, error: keyError } = await supabase
      .from('user_api_keys')
      .select('provider, api_key, project_id, location_id, use_vertex_ai, model_name, json_key_content, api_endpoint')
      .eq('id', selectedKeyId)
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .single();

    if (keyError || !keyDetails) {
      throw new Error('No se encontró una API key activa con el ID proporcionado para este usuario. Por favor, verifica la Gestión de API Keys.');
    }

    let finalModel = keyDetails.model_name;
    let aiResponseContent: string;

    if (keyDetails.provider === 'google_gemini') {
      const geminiMessages = messages.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: convertToGeminiParts(msg.content),
      }));

      if (keyDetails.use_vertex_ai) {
        const project = keyDetails.project_id;
        const location = keyDetails.location_id;
        const jsonKeyContent = keyDetails.json_key_content;

        if (!project || !location) {
          throw new Error('Project ID y Location ID son requeridos para Vertex AI. Por favor, configúralos en la Gestión de API Keys.');
        }
        if (!jsonKeyContent) {
          throw new Error('El contenido del archivo JSON de la cuenta de servicio es requerido para Vertex AI. Por favor, súbelo en la Gestión de API Keys.');
        }
        if (!finalModel) {
          throw new Error('Nombre de modelo no configurado para Vertex AI. Por favor, selecciona un modelo en la Gestión de API Keys.');
        }

        const credentials = JSON.parse(jsonKeyContent);
        const auth = new GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });
        const client = await auth.getClient();
        const accessToken = (await client.getAccessToken()).token;

        if (!accessToken) {
          throw new Error('No se pudo obtener el token de acceso para Vertex AI.');
        }

        const vertexAiUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${finalModel}:generateContent`;

        const vertexAiResponse = await fetch(vertexAiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ contents: geminiMessages }),
        });

        if (!vertexAiResponse.ok) {
          const errorText = await vertexAiResponse.text();
          console.error(`[API /ai/chat] Vertex AI API returned non-OK status: ${vertexAiResponse.status}. Response: ${errorText}`);
          throw new Error(`Vertex AI API returned an error: ${vertexAiResponse.status} - ${errorText.substring(0, 200)}...`);
        }

        const vertexAiResult = await vertexAiResponse.json();

        if (vertexAiResult.error) {
          throw new Error(vertexAiResult.error?.message || `Error en la API de Vertex AI: ${JSON.stringify(vertexAiResult)}`);
        }

        aiResponseContent = vertexAiResult.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo obtener una respuesta de texto de Vertex AI.';

      } else { // Public Gemini API
        const apiKey = keyDetails.api_key;
        if (!apiKey) {
          throw new Error('API Key no encontrada para Google Gemini. Por favor, configúrala en la Gestión de API Keys.');
        }
        const genAI = new GoogleGenerativeAI(apiKey);
        if (!finalModel) {
          finalModel = 'gemini-1.5-flash-latest'; // Fallback to a default if not set
        }

        const result = await genAI.getGenerativeModel({ model: finalModel }).generateContent({ contents: geminiMessages });
        aiResponseContent = result.response.text();
      }
    } else if (keyDetails.provider === 'custom_endpoint') {
      const customApiKey = keyDetails.api_key;
      const customEndpointUrl = keyDetails.api_endpoint;
      const customModelId = keyDetails.model_name;

      if (!customEndpointUrl || !customApiKey || !customModelId) {
        throw new Error('Configuración incompleta para el endpoint personalizado. Asegúrate de que el endpoint, la API Key y el ID del modelo estén configurados.');
      }

      const customApiMessages = messages.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: messageContentToString(msg.content), // Convert content to string for custom endpoint
      }));

      const customEndpointResponse = await fetch(customEndpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${customApiKey}`,
        },
        body: JSON.stringify({
          model: customModelId,
          messages: customApiMessages,
        }),
      });

      if (!customEndpointResponse.ok) {
        const errorText = await customEndpointResponse.text();
        console.error(`[API /ai/chat] Custom Endpoint API returned non-OK status: ${customEndpointResponse.status}. Response: ${errorText}`);
        throw new Error(`Custom Endpoint API returned an error: ${customEndpointResponse.status} - ${errorText.substring(0, 200)}...`);
      }

      const customEndpointResult = await customEndpointResponse.json();
      aiResponseContent = customEndpointResult.choices?.[0]?.message?.content || 'No se pudo obtener una respuesta del endpoint personalizado.';

    } else {
      throw new Error('Proveedor de IA no válido seleccionado.');
    }

    return NextResponse.json({ message: { content: aiResponseContent } });

  } catch (error: any) {
    console.error('[API /ai/chat] Error:', error);
    
    let userFriendlyMessage = 'Ocurrió un error inesperado con la API de IA.';
    const errorMessage = error.message || '';

    if (errorMessage.includes('503') || errorMessage.toLowerCase().includes('overloaded')) {
      userFriendlyMessage = 'El modelo de IA está sobrecargado en este momento. Por favor, intenta de nuevo en unos minutos o cambia a otro modelo.';
    } else if (errorMessage.toLowerCase().includes('api key not valid') || errorMessage.toLowerCase().includes('invalid api key')) {
      userFriendlyMessage = 'Tu API Key no es válida. Por favor, verifica que sea correcta en la Gestión de API Keys.';
    } else if (errorMessage.includes('Vertex AI API returned an error:')) {
      userFriendlyMessage = errorMessage;
    } else if (errorMessage.includes('GOOGLE_CLOUD_PROJECT') || errorMessage.includes('GOOGLE_CLOUD_LOCATION')) {
      userFriendlyMessage = `Error de configuración de Vertex AI: ${errorMessage}`;
    } else if (errorMessage.includes('Custom Endpoint API returned an error:')) {
      userFriendlyMessage = errorMessage;
    }
    else {
      userFriendlyMessage = `Error en la API de IA: ${errorMessage}`;
    }

    return NextResponse.json({ message: userFriendlyMessage }, { status: 500 });
  }
}