export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { GoogleAuth } from 'google-auth-library';
import { z } from 'zod';
import { SUPERUSER_EMAILS, PERMISSION_KEYS, UserPermissions } from '@/lib/constants';

// Define unified part types for internal API handling
interface TextPart { type: 'text'; text: string; }
interface ImagePart { type: 'image_url'; image_url: { url: string }; }
interface CodePart { type: 'code'; language?: string; filename?: string; code?: string; }
type MessageContentPart = TextPart | ImagePart | CodePart;

// Define the schema for incoming messages from the client
const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.union([
    z.string(),
    z.array(z.union([
      z.object({ type: z.literal('text'), text: z.string() }),
      z.object({ type: z.literal('image_url'), image_url: z.object({ url: z.string() }) }),
      z.object({ type: z.literal('code'), language: z.string().optional(), filename: z.string().optional(), code: z.string().optional() }),
    ]))
  ]),
});

const chatRequestSchema = z.object({
  messages: z.array(messageSchema),
  selectedKeyId: z.string(), // Can be a key ID or a group ID
  stream: z.boolean().optional().default(true), // New field to control streaming
});

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

// Helper to convert internal content parts to a string for token counting and custom endpoints
function messageContentToString(content: any): string { // Change type to any for robustness
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    // Explicitly convert to array to ensure it has .map method
    const contentArray = Array.from(content); 
    return contentArray.map((part: any) => { // Cast part to any
      if (part && typeof part === 'object' && 'type' in part) {
        if (part.type === 'text') return part.text;
        if (part.type === 'code') return `\`\`\`${part.language || ''}${part.filename ? `:${part.filename}` : ''}\n${part.code || ''}\n\`\`\``;
        if (part.type === 'image_url') return `[Imagen: ${part.image_url.url.substring(0, 30)}...]`;
      }
      console.warn("Skipping invalid message content part in messageContentToString:", part);
      return '';
    }).join('\n\n');
  }
  // If content is not a string and not an array, log and return empty string
  console.warn("Unexpected content type in messageContentToString (not string or array):", typeof content, content);
  return '';
}

// Helper to convert internal content parts to Gemini API parts
const convertToGeminiParts = (content: any): Part[] => { // Change type to any for robustness
  const parts: Part[] = [];
  if (typeof content === 'string') {
    parts.push({ text: content });
  } else if (Array.isArray(content)) {
    // Explicitly convert to array to ensure it has .forEach method
    const contentArray = Array.from(content);
    for (const part of contentArray) { // Iterate over the guaranteed array
      if (part && typeof part === 'object' && 'type' in part) {
        if (part.type === 'text') {
          parts.push({ text: part.text });
        } else if (part.type === 'image_url') {
          const url = part.image_url.url;
          const match = url.match(/^data:(image\/\w+);base64,(.*)$/);
          if (!match) {
            console.warn("Skipping invalid image data URL format for Gemini:", url.substring(0, 50) + '...');
            parts.push({ text: "[Unsupported Image]" });
          } else {
            const mimeType = match[1] || 'application/octet-stream'; // Provide a default mimeType
            const data = match[2] || ''; // Provide a default data
            parts.push({ inlineData: { mimeType, data } });
          }
        } else if (part.type === 'code') {
          const codePart = part as CodePart;
          const lang = codePart.language || '';
          const filename = codePart.filename ? `:${codePart.filename}` : '';
          parts.push({ text: `\`\`\`${lang}${filename}\n${codePart.code || ''}\n\`\`\`` });
        }
      } else {
        console.warn("Skipping invalid message content part in convertToGeminiParts:", part);
        parts.push({ text: "[Invalid Content Part]" });
      }
    }
  } else {
    // If content is not a string and not an array, log and return empty parts
    console.warn("Unexpected content type in convertToGeminiParts (not string or array):", typeof content, content);
  }
  return parts;
};

// Helper to estimate token count (simple heuristic)
const estimateTokens = (text: string) => Math.ceil(text.length / 4);

// Helper to truncate message history based on token limit
function truncateMessagesByTokenLimit(messages: any[], limit: number, systemPrompt: string) {
  let totalTokens = estimateTokens(systemPrompt);
  const truncatedMessages = [];

  // Iterate backwards from the most recent message
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const contentString = messageContentToString(message.content);
    const messageTokens = estimateTokens(contentString);

    if (totalTokens + messageTokens > limit) {
      // Stop if adding the next message would exceed the limit
      break;
    }

    truncatedMessages.unshift(message); // Add to the beginning to maintain order
    totalTokens += messageTokens;
  }

  console.log(`[AI Context] Truncated context to ${totalTokens} tokens (limit: ${limit}). Kept ${truncatedMessages.length} of ${messages.length} messages.`);
  return truncatedMessages;
}


export async function POST(req: NextRequest) {
  const { session, userRole } = await getSessionAndRole();
  if (!session) {
    return NextResponse.json({ message: 'Acceso denegado.' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const body = await req.json();
    const { messages: rawMessages, selectedKeyId, stream } = chatRequestSchema.parse(body);

    console.log("[API /ai/chat] Received rawMessages:", JSON.stringify(rawMessages, null, 2));

    let keysToTry: any[] = [];
    let selectedKeyIsGroup = false;

    // Check if selectedKeyId is a group ID
    const { data: group, error: groupError } = await supabase
      .from('ai_key_groups')
      .select('*, api_keys(*)')
      .eq('id', selectedKeyId)
      .single();

    if (groupError && groupError.code !== 'PGRST116') { // PGRST116 means "no rows found"
      console.error("[API /ai/chat] Error fetching AI key group:", groupError);
      throw new Error('Error al verificar el grupo de claves.');
    }

    if (group) {
      selectedKeyIsGroup = true;
      // Filter for active keys within the group
      keysToTry = group.api_keys.filter((key: any) => key.status === 'active');
      if (keysToTry.length === 0) {
        throw new Error(`No hay claves activas en el grupo '${group.name}'.`);
      }
      // Implement simple round-robin by sorting by last_used_at (oldest first)
      keysToTry.sort((a: any, b: any) => new Date(a.last_used_at || 0).getTime() - new Date(b.last_used_at || 0).getTime());
    } else {
      // If not a group, assume it's an individual key ID
      const { data: individualKey, error: keyError } = await supabase
        .from('user_api_keys')
        .select('provider, api_key, project_id, location_id, use_vertex_ai, model_name, json_key_content, api_endpoint, is_global, user_id, status, status_message')
        .eq('id', selectedKeyId)
        .eq('is_active', true)
        .single();

      if (keyError || !individualKey) {
        console.error("[API /ai/chat] Individual key fetch error:", keyError);
        throw new Error('No se encontró una API key activa con el ID proporcionado.');
      }
      if (individualKey.status !== 'active') {
        throw new Error(`La API key seleccionada está en estado '${individualKey.status}'.`);
      }
      keysToTry.push(individualKey);
    }

    let finalResponse: any = null;
    let lastError: any = null;
    let keyUsedForResponse: any = null;

    for (const keyDetails of keysToTry) {
      try {
        // Authorization check for the fetched key
        const isOwner = keyDetails.user_id === session.user.id;
        if (!keyDetails.is_global && !isOwner && userRole !== 'super_admin') {
          console.warn(`[AI Chat] Access denied for key ${keyDetails.id}: not global, not owner, and user is not super_admin.`);
          throw new Error('Acceso denegado. No tienes permiso para usar esta clave.');
        }

        keyUsedForResponse = keyDetails;
        let finalModel = keyDetails.model_name;
        
        // Determine token limit based on provider
        const tokenLimit = keyDetails.provider === 'google_gemini' ? 1000000 : 200000;

        // Extract system prompt and filter it out from conversation messages
        const systemPromptMessage = rawMessages.find(m => m.role === 'system');
        const systemPrompt = systemPromptMessage ? messageContentToString(systemPromptMessage.content) : '';
        const conversationMessages = rawMessages.filter(m => m.role !== 'system');

        // Truncate conversation history
        const truncatedMessages = truncateMessagesByTokenLimit(conversationMessages, tokenLimit, systemPrompt);

        if (keyDetails.provider === 'google_gemini') {
          const geminiFormattedMessages: { role: 'user' | 'model'; parts: Part[] }[] = [];
          // Add system prompt as a text part in the first user message
          if (systemPrompt) {
            geminiFormattedMessages.push({ role: 'user', parts: [{ text: systemPrompt }] });
          }

          for (let i = 0; i < truncatedMessages.length; i++) {
            const msg = truncatedMessages[i];
            if (msg.role === 'user') {
              geminiFormattedMessages.push({ role: 'user', parts: convertToGeminiParts(msg.content) });
            } else if (msg.role === 'assistant') {
              geminiFormattedMessages.push({ role: 'model', parts: convertToGeminiParts(msg.content) });
            }
          }
          
          if (keyDetails.use_vertex_ai) {
            // Vertex AI streaming not implemented yet, return a placeholder or handle as non-streaming
            // For now, we'll just return a non-streaming response.
            return NextResponse.json({ message: { content: "Vertex AI streaming not implemented yet." } });

          } else { // Public Gemini API
            const apiKey = keyDetails.api_key;
            if (!apiKey) throw new Error('API Key no encontrada para Google Gemini.');
            const genAI = new GoogleGenerativeAI(apiKey);
            if (!finalModel) finalModel = 'gemini-1.5-flash-latest';

            const result = await genAI.getGenerativeModel({ model: finalModel }).generateContentStream({ contents: geminiFormattedMessages });
            
            const streamResponse = new ReadableStream({
              async start(controller) {
                for await (const chunk of result.stream) {
                  const chunkText = chunk.text();
                  controller.enqueue(new TextEncoder().encode(chunkText));
                }
                controller.close();
              },
            });

            finalResponse = new Response(streamResponse, {
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
          }
        } else if (keyDetails.provider === 'custom_endpoint') {
          const customApiKey = keyDetails.api_key;
          const customEndpointUrl = keyDetails.api_endpoint;
          const customModelId = keyDetails.model_name;

          if (!customEndpointUrl || !customModelId) { // Removed customApiKey from this check
            console.error("[AI Chat] Custom endpoint configuration incomplete:", { customEndpointUrl, customModelId });
            throw new Error('Configuración incompleta para el endpoint personalizado (URL o ID de modelo faltante).');
          }

          const customApiMessages = [
            { role: 'system', content: systemPrompt },
            ...truncatedMessages.map((msg: any) => ({
              role: msg.role === 'assistant' ? 'assistant' : 'user',
              content: messageContentToString(msg.content),
            })),
          ];

          const headers: HeadersInit = {
            'Content-Type': 'application/json',
          };

          if (customApiKey) { // Conditionally add Authorization header
            headers['Authorization'] = `Bearer ${customApiKey}`;
          }

          console.log(`[AI Chat] Calling custom endpoint: ${customEndpointUrl} with model: ${customModelId}`);
          const customEndpointResponse = await fetch(customEndpointUrl, {
            method: 'POST',
            headers: headers, // Use the conditionally built headers
            body: JSON.stringify({
              model: customModelId,
              messages: customApiMessages,
              stream: false, // Force non-streaming for custom endpoints
            }),
            signal: AbortSignal.timeout(120000) // 2 minutes timeout for external API call
          });

          console.log(`[AI Chat] Custom endpoint response status: ${customEndpointResponse.status}`);

          if (!customEndpointResponse.ok) {
            const errorText = await customEndpointResponse.text();
            console.error(`[AI Chat] Custom Endpoint API returned an error: ${customEndpointResponse.status} - ${errorText.substring(0, 500)}...`);
            throw new Error(`Custom Endpoint API returned an error: ${customEndpointResponse.status} - ${errorText.substring(0, 200)}...`);
          }

          const result = await customEndpointResponse.json();
          console.log("[AI Chat] Custom endpoint response body:", JSON.stringify(result, null, 2));

          const content = result.choices[0]?.message?.content || '';
          
          finalResponse = NextResponse.json({ message: { content } });

        } else {
          console.error(`[AI Chat] Invalid AI provider selected: ${keyDetails.provider}`);
          throw new Error('Proveedor de IA no válido seleccionado.');
        }

        // If successful, update last_used_at and break
        await supabase.from('user_api_keys').update({ last_used_at: new Date().toISOString(), status: 'active', status_message: null }).eq('id', keyDetails.id);
        break; // Exit loop on first successful key
      } catch (error: any) {
        lastError = error;
        console.error(`[AI Chat] Key ${keyDetails.id} failed: ${error.message}. Trying next key...`);
        // Mark key as failed in DB
        await supabase.from('user_api_keys').update({ status: 'failed', status_message: error.message }).eq('id', keyDetails.id);
        // Log critical alert for Super Admins
        await supabase.from('server_events_log').insert({
          user_id: session.user.id,
          event_type: 'api_key_failed',
          description: `La API Key '${keyDetails.nickname || keyDetails.id}' (${keyDetails.provider}) falló. Mensaje: ${error.message}`,
          command_details: `Key ID: ${keyDetails.id}, Group ID: ${keyDetails.group_id || 'N/A'}`,
        });
      }
    }

    if (!finalResponse) {
      throw lastError || new Error('Todas las API Keys intentadas fallaron.');
    }

    return finalResponse;

  } catch (error: any) {
    console.error('[API /ai/chat] Unhandled error:', error);
    let userFriendlyMessage = `Error en la API de IA: ${error.message}`;
    return NextResponse.json({ message: userFriendlyMessage }, { status: 500 });
  }
}