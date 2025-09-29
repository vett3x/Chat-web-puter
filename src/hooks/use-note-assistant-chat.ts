"use client";

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ApiKey } from '@/hooks/use-user-api-keys';
import { AI_PROVIDERS } from '@/lib/ai-models';
import { parseAiResponseToRenderableParts, RenderablePart } from '@/lib/utils';

// Define unified part types
interface TextPart { type: 'text'; text: string; }
interface ImagePart { type: 'image_url'; image_url: { url: string }; }
interface CodePart { type: 'code'; language?: string; filename?: string; code?: string; }

// The format Puter.js API expects for content arrays
type PuterContentPart = TextPart | ImagePart;

interface PuterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | PuterContentPart[];
}

declare global {
  interface Window {
    puter: {
      ai: {
        chat: (messages: PuterMessage[], options: { model: string, stream?: boolean }) => Promise<any>;
      };
    };
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | RenderablePart[]; // MODIFICADO: Ahora content puede ser string o RenderablePart[]
  id?: string;
  isTyping?: boolean;
  isNew?: boolean; // Añadido para consistencia con el tipo Message
  isAnimated?: boolean; // Añadido para consistencia con el tipo Message
}

// Function to determine the default model based on user preferences and available keys
const determineDefaultModel = (userApiKeys: ApiKey[]): string => {
  if (typeof window !== 'undefined') {
    const storedDefaultModel = localStorage.getItem('default_ai_model');
    if (storedDefaultModel && (userApiKeys.some(key => `user_key:${key.id}` === storedDefaultModel) || AI_PROVIDERS.some(p => p.models.some(m => `puter:${m.value}` === storedDefaultModel)))) {
      return storedDefaultModel;
    }
  }

  // Prioritize global keys
  const globalKey = userApiKeys.find(key => key.is_global);
  if (globalKey) {
    return `user_key:${globalKey.id}`;
  }

  // Then prioritize Claude models
  const claudeModel = AI_PROVIDERS.find(p => p.value === 'anthropic_claude')?.models[0];
  if (claudeModel) {
    return `puter:${claudeModel.value}`;
  }

  // Fallback to any available user key
  if (userApiKeys.length > 0) {
    return `user_key:${userApiKeys[0].id}`;
  }

  // Final fallback if no keys or Puter models are available
  return 'puter:claude-sonnet-4'; // A safe default if nothing else works
};

interface UseNoteAssistantChatProps {
  noteTitle: string;
  noteContent: string;
  initialChatHistory: ChatMessage[] | null;
  onSaveHistory: (history: ChatMessage[]) => void;
  userApiKeys: ApiKey[];
  isLoadingApiKeys: boolean;
}

function messageContentToApiFormat(content: string | RenderablePart[]): string | PuterContentPart[] {
    if (typeof content === 'string') {
        return content;
    }

    if (Array.isArray(content)) {
        return content.map((part) => {
            if (part.type === 'text') {
                return { type: 'text', text: part.text };
            } else if (part.type === 'code') {
                const codePart = part as CodePart;
                const lang = codePart.language || '';
                const filename = codePart.filename ? `:${codePart.filename}` : '';
                return { type: 'text', text: `\`\`\`${lang}${filename}\n${codePart.code || ''}\n\`\`\`` };
            } else if (part.type === 'image_url') {
                return part;
            }
            return { type: 'text', text: '' };
        }).filter(Boolean) as PuterContentPart[];
    }

    return '';
}

export function useNoteAssistantChat({
  noteTitle,
  noteContent,
  initialChatHistory,
  onSaveHistory,
  userApiKeys,
  isLoadingApiKeys,
}: UseNoteAssistantChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPuterReady, setIsPuterReady] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(''); // Initialize as empty string

  const defaultWelcomeMessage: ChatMessage = { role: 'assistant', content: 'Hola, soy tu asistente. Pregúntame cualquier cosa sobre esta nota.' };

  useEffect(() => {
    const checkPuter = () => {
      if (typeof window !== 'undefined' && window.puter) {
        setIsPuterReady(true);
      } else {
        setTimeout(checkPuter, 100);
      }
    };
    checkPuter();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('selected_ai_model_note_chat', selectedModel);
    }
  }, [selectedModel]);

  useEffect(() => {
    if (isLoadingApiKeys) return;

    const newDefaultModel = determineDefaultModel(userApiKeys);
    setSelectedModel(newDefaultModel);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selected_ai_model_note_chat', newDefaultModel);
    }
  }, [isLoadingApiKeys, userApiKeys]);

  useEffect(() => {
    setMessages(initialChatHistory && initialChatHistory.length > 0 ? initialChatHistory : [defaultWelcomeMessage]);
  }, [initialChatHistory]);

  const handleSendMessage = useCallback(async (userInput: string) => {
    if (!userInput.trim() || isLoading) return;

    const userMessageForUI: ChatMessage = { role: 'user', content: userInput, isNew: true, isAnimated: true };
    const newMessages: ChatMessage[] = [...messages, userMessageForUI];
    setMessages(newMessages);
    setIsLoading(true);

    const assistantMessageId = `assistant-${Date.now()}`;
    setMessages(prev => [...prev, { role: 'assistant', content: '', isTyping: true, id: assistantMessageId, isNew: true, isAnimated: false }]);

    try {
      const systemPromptContent = `Eres un asistente de notas. Tu tarea es responder preguntas sobre la nota proporcionada. Sé conciso y directo.
---
Título: ${noteTitle}
Contenido:
${noteContent}
---`;

      const messagesForApi: PuterMessage[] = [
        { role: 'system', content: systemPromptContent },
        ...messages.map(msg => ({ role: msg.role, content: messageContentToApiFormat(msg.content) })),
        { role: 'user', content: userInput }
      ];

      let fullResponseText = '';

      if (selectedModel.startsWith('puter:')) {
        const actualModelForPuter = selectedModel.substring(6);
        const response = await window.puter.ai.chat(messagesForApi, { model: actualModelForPuter });
        if (!response || response.error) throw new Error(response?.error?.message || JSON.stringify(response?.error) || 'Error de la IA.');
        fullResponseText = response?.message?.content || 'Sin contenido.';
      } else if (selectedModel.startsWith('user_key:')) {
        const apiResponse = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: messagesForApi,
            selectedKeyId: selectedModel.substring(9),
          }),
        });
        if (!apiResponse.ok || !apiResponse.body) {
          const errorData = await apiResponse.json();
          throw new Error(errorData.message || 'Error en la API de IA.');
        }
        const responseStream = apiResponse.body;
        const reader = responseStream.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullResponseText += chunk;
          setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: parseAiResponseToRenderableParts(fullResponseText, false), isTyping: false, isNew: true } : m));
        }
      } else {
        throw new Error('Modelo de IA no válido seleccionado.');
      }

      const finalContentForMessage = parseAiResponseToRenderableParts(fullResponseText, false);

      const finalMessages = [...newMessages, { role: 'assistant' as const, content: finalContentForMessage, isNew: true, isAnimated: false }];
      setMessages(finalMessages);
      onSaveHistory(finalMessages);

    } catch (error: any) {
      const errorMessage = error?.message || 'Ocurrió un error desconocido.';
      toast.error(errorMessage);
      setMessages(prev => prev.filter(m => m.id !== assistantMessageId));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, selectedModel, noteTitle, noteContent, onSaveHistory, userApiKeys]);

  const handleModelChange = (modelValue: string) => {
    setSelectedModel(modelValue);
  };

  const handleClearChat = () => {
    setMessages([defaultWelcomeMessage]);
    onSaveHistory([defaultWelcomeMessage]);
    toast.success('Historial del chat limpiado.');
  };

  return {
    messages,
    isLoading,
    isPuterReady: true, // Assuming puter is always ready here for simplicity
    selectedModel,
    handleModelChange,
    sendMessage: handleSendMessage,
    clearChat: handleClearChat,
  };
}