"use server";

import { ApiKey } from '@/hooks/use-user-api-keys';
import { Message } from '@/types/chat';

// The format Puter.js API expects for content arrays
interface TextPart { type: 'text'; text: string; }
interface ImagePart { type: 'image_url'; image_url: { url: string; }; }
type PuterContentPart = TextPart | ImagePart;

interface PuterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | PuterContentPart[];
}

function messageContentToApiFormat(content: Message['content']): string | PuterContentPart[] {
    if (typeof content === 'string') {
        return content;
    }

    if (Array.isArray(content)) {
        return content.map((part) => {
            if (part.type === 'text') {
                return { type: 'text', text: part.text };
            } else if (part.type === 'code') {
                const codePart = part as any;
                const lang = codePart.language || '';
                const filename = codePart.filename ? `:${codePart.filename}` : '';
                return { type: 'text', text: `\`\`\`${lang}${filename}\n${codePart.code || ''}\n\`\`\`` };
            } else if (part.type === 'image_url') {
                return part as ImagePart;
            }
            return { type: 'text', text: '' };
        }).filter(Boolean) as PuterContentPart[];
    }

    return '';
}

export async function fetchAiResponse(
  history: Message[],
  systemPrompt: string,
  selectedModel: string,
  userApiKeys: ApiKey[]
): Promise<{ content: string; modelUsed: string }> {
  const systemMessage: PuterMessage = { role: 'system', content: systemPrompt };
  const messagesForApi = history.map(msg => ({
    role: msg.role,
    content: messageContentToApiFormat(msg.content),
  }));

  let response: any;
  let modelUsedForResponse: string;

  if (selectedModel.startsWith('puter:')) {
    const actualModelForPuter = selectedModel.substring(6);
    modelUsedForResponse = selectedModel;
    response = await window.puter.ai.chat([systemMessage, ...messagesForApi], { model: actualModelForPuter });
  } else if (selectedModel.startsWith('user_key:')) {
    modelUsedForResponse = selectedModel;
    const apiResponse = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [systemMessage, ...messagesForApi],
        selectedKeyId: selectedModel.substring(9),
      }),
    });
    response = await apiResponse.json();
    if (!apiResponse.ok) throw new Error(response.message || 'Error en la API de IA.');
  } else {
    throw new Error('Modelo de IA no válido seleccionado.');
  }

  if (!response || response.error) {
    throw new Error(response?.error?.message || JSON.stringify(response?.error) || 'Error de la IA.');
  }

  const assistantMessageContent = response?.message?.content || 'Sin contenido.';
  return { content: assistantMessageContent, modelUsed: modelUsedForResponse };
}