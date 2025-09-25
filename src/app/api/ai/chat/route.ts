export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { GoogleGenAI, Part } from '@google/genai';
import { GoogleAuth } from 'google-auth-library';

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

// Define unified part types for internal API handling
interface TextPart { type: 'text'; text: string; }
interface ImagePart { type: 'image_url'; image_url: { url: string }; }
type PuterContentPart = TextPart | ImagePart; // This is what messageContentToApiFormat now returns in an array

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  try {
    const { messages, selectedKeyId } = await req.json();

    if (!selectedKeyId) {
      return NextResponse.json({ message: 'ID de clave de API no proporcionado.' }, { status: 400 });
    }

    const { data: keyDetails, error: keyError } = await supabase
      .from('user_api_keys')
      .select('provider, api_key, project_id, location_id, use_vertex_ai, model_name, json_key_content, api_endpoint') // Select api_endpoint
      .eq('id', selectedKeyId)
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .single();

    if (keyError || !keyDetails) {
      throw new Error('No se encontró una API key activa con el ID proporcionado para este usuario. Por favor, verifica la Gestión de API Keys.');
    }

    let genAI: GoogleGenAI;
    let finalModel = keyDetails.model_name;

    const convertToGeminiParts = (content: string | PuterContentPart[]): Part[] => { // MODIFIED: Expect string or PuterContentPart[]
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
          // No need for 'code' type here, as it's converted to 'text' in use-chat.ts
        }
      }
      return parts;
    };

    if (keyDetails.provider === 'google_gemini') {
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

        // Authenticate using the provided JSON key content
        const credentials = JSON.parse(jsonKeyContent);
        const auth = new GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });
        const client = await auth.getClient(); // Get the authenticated client
        const accessToken = (await client.getAccessToken()).token;

        if (!accessToken) {
          throw new Error('No se pudo obtener el token de acceso para Vertex AI.');
        }

        const vertexAiUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${finalModel}:generateContent`;

        const contents = messages.map((msg: any) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: convertToGeminiParts(msg.content), // Use the unified converter
        }));

        const vertexAiResponse = await fetch(vertexAiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ contents }),
        });

        // --- START: Added error logging for non-OK responses ---
        if (!vertexAiResponse.ok) {
          const errorText = await vertexAiResponse.text();
          console.error(`[API /ai/chat] Vertex AI API returned non-OK status: ${vertexAiResponse.status}. Response: ${errorText}`);
          throw new Error(`Vertex AI API returned an error: ${vertexAiResponse.status} - ${errorText.substring(0, 200)}...`);
        }
        // --- END: Added error logging for non-OK responses ---

        const vertexAiResult = await vertexAiResponse.json();

        if (vertexAiResult.error) { // Check for error object within a 200 OK response
          throw new Error(vertexAiResult.error?.message || `Error en la API de Vertex AI: ${JSON.stringify(vertexAiResult)}`);
        }

        const text = vertexAiResult.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo obtener una respuesta de texto de Vertex AI.';
        return NextResponse.json({ message: { content: text } });

      } else { // Public Gemini API
        const apiKey = keyDetails.api_key;
        if (!apiKey) {
          throw new Error('API Key no encontrada para Google Gemini. Por favor, configúrala en la Gestión de API Keys.');
        }
        genAI = new GoogleGenAI({ apiKey });
        if (!finalModel) {
          finalModel = 'gemini-1.5-flash-latest'; // Fallback to a default if not set
        }

        const contents = messages.map((msg: any) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: convertToGeminiParts(msg.content), // Use the unified converter
        }));

        const result = await genAI.models.generateContent({ model: finalModel, contents });
        const text = result.text;

        return NextResponse.json({ message: { content: text } });
      }
    } else if (keyDetails.provider === 'custom_endpoint') { // NEW: Custom Endpoint Logic
      const customApiKey = keyDetails.api_key;
      const customEndpointUrl = keyDetails.api_endpoint;
      const customModelId = keyDetails.model_name;

      if (!customEndpointUrl || !customApiKey || !customModelId) {
        throw new Error('Configuración incompleta para el endpoint personalizado. Asegúrate de que el endpoint, la API Key y el ID del modelo estén configurados.');
      }

      const customApiMessages = messages.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user', // Custom endpoints often expect 'assistant' for model responses
        content: msg.content, // Send content as is, assuming custom endpoint handles PuterContentPart[] or string
      }));

      const customEndpointResponse = await fetch(customEndpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${customApiKey}`, // Common pattern for API keys
        },
        body: JSON.stringify({
          model: customModelId,
          messages: customApiMessages,
          // Add other parameters as needed by the custom endpoint, e.g., temperature, max_tokens
        }),
      });

      if (!customEndpointResponse.ok) {
        const errorText = await customEndpointResponse.text();
        console.error(`[API /ai/chat] Custom Endpoint API returned non-OK status: ${customEndpointResponse.status}. Response: ${errorText}`);
        throw new Error(`Custom Endpoint API returned an error: ${customEndpointResponse.status} - ${errorText.substring(0, 200)}...`);
      }

      const customEndpointResult = await customEndpointResponse.json();
      const text = customEndpointResult.choices?.[0]?.message?.content || 'No se pudo obtener una respuesta del endpoint personalizado.';
      return NextResponse.json({ message: { content: text } });

    } else {
      throw new Error('Proveedor de IA no válido seleccionado.');
    }

  } catch (error: any) {
    console.error('[API /ai/chat] Error:', error);
    
    let userFriendlyMessage = 'Ocurrió un error inesperado con la API de IA.';
    const errorMessage = error.message || '';

    if (errorMessage.includes('503') || errorMessage.toLowerCase().includes('overloaded')) {
      userFriendlyMessage = 'El modelo de IA está sobrecargado en este momento. Por favor, intenta de nuevo en unos minutos o cambia a otro modelo.';
    } else if (errorMessage.toLowerCase().includes('api key not valid') || errorMessage.toLowerCase().includes('invalid api key')) {
      userFriendlyMessage = 'Tu API Key no es válida. Por favor, verifica que sea correcta en la Gestión de API Keys.';
    } else if (errorMessage.includes('Vertex AI API returned an error:')) { // Catch our custom error
      userFriendlyMessage = errorMessage; // Use the detailed error from our check
    } else if (errorMessage.includes('GOOGLE_CLOUD_PROJECT') || errorMessage.includes('GOOGLE_CLOUD_LOCATION')) {
      userFriendlyMessage = `Error de configuración de Vertex AI: ${errorMessage}`;
    } else if (errorMessage.includes('Custom Endpoint API returned an error:')) {
      userFriendlyMessage = errorMessage; // Use the detailed error from our check
    }
    else {
      userFriendlyMessage = `Error en la API de IA: ${errorMessage}`;
    }

    return NextResponse.json({ message: userFriendlyMessage }, { status: 500 });
  }
}