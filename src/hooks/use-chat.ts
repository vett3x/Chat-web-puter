"use client";

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSession } from '@/components/session-context-provider';
import { AI_PROVIDERS } from '@/lib/ai-models';

// Define unified part types
interface TextPart {
  type: 'text';
  text: string;
}
interface ImagePart {
  type: 'image_url';
  image_url: { url: string };
}
interface CodePart {
  type: 'code';
  language?: string;
  filename?: string;
  code?: string;
}

// Union of all possible content parts for our internal state
type MessageContentPart = TextPart | ImagePart | CodePart;

// The format Puter.js API expects for content arrays
type PuterContentPart = TextPart | ImagePart;

interface PuterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | PuterContentPart[];
}

// Add global declaration for window.puter to fix TypeScript errors
declare global {
  interface Window {
    puter: {
      ai: {
        chat: (messages: PuterMessage[], options: { model: string }) => Promise<any>;
      };
    };
  }
}

// The type returned by our response parser
type RenderablePart = TextPart | CodePart;

interface Message {
  id: string;
  conversation_id?: string;
  content: string | MessageContentPart[]; // Use the unified type
  role: 'user' | 'assistant';
  model?: string;
  timestamp: Date;
  isNew?: boolean;
  isTyping?: boolean;
  type?: 'text' | 'multimodal';
}

interface ApiKey {
  id: string;
  provider: string;
  nickname: string | null;
  model_name: string | null;
}

interface UseChatProps {
  userId: string | undefined;
  conversationId: string | null;
  onNewConversationCreated: (conversationId: string) => void;
  onConversationTitleUpdate: (conversationId: string, newTitle: string) => void;
  appPrompt?: string | null;
  appId?: string | null;
  onWriteFiles: (files: { path: string; content: string }[]) => Promise<void>;
}

const codeBlockRegex = /```(\w+)?(?::([\w./-]+))?\s*\n([\s\S]*?)\s*```/g;

function parseAiResponseToRenderableParts(content: string): RenderablePart[] {
  const parts: RenderablePart[] = [];
  let lastIndex = 0;
  let match;
  codeBlockRegex.lastIndex = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textPart = content.substring(lastIndex, match.index).trim();
      if (textPart) parts.push({ type: 'text', text: textPart });
    }
    
    const part: RenderablePart = {
      type: 'code',
      language: match[1] || '',
      filename: match[2],
      code: (match[3] || '').trim(),
    };

    if (!part.filename && part.code) {
      const lines = part.code.split('\n');
      const firstLine = lines[0].trim();
      const pathRegex = /^(?:\/\/|#|\/\*|\*)\s*([\w./-]+\.[a-zA-Z]+)\s*\*?\/?$/;
      const pathMatch = firstLine.match(pathRegex);
      if (pathMatch && pathMatch[1]) {
        part.filename = pathMatch[1];
        part.code = lines.slice(1).join('\n').trim();
      }
    }

    parts.push(part);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const textPart = content.substring(lastIndex).trim();
    if (textPart) parts.push({ type: 'text', text: textPart });
  }

  return parts.length > 0 ? parts : [{ type: 'text', text: content }];
}

function messageContentToApiFormat(content: Message['content']): string | PuterContentPart[] {
    if (typeof content === 'string') {
        return content;
    }

    if (Array.isArray(content)) {
        const hasCodePart = content.some(p => p.type === 'code');

        if (!hasCodePart) {
            return content as PuterContentPart[];
        }

        return content.map((part) => {
            switch (part.type) {
                case 'text':
                    return (part as TextPart).text;
                case 'code':
                    const codePart = part as CodePart;
                    const lang = codePart.language || '';
                    const filename = codePart.filename ? `:${codePart.filename}` : '';
                    return `\`\`\`${lang}${filename}\n${codePart.code || ''}\n\`\`\``;
                case 'image_url':
                    return `[Image Attached: ${(part as ImagePart).image_url.url}]`;
            }
        }).join('\n\n');
    }

    return '';
}

export function useChat({
  userId,
  conversationId,
  onNewConversationCreated,
  onConversationTitleUpdate,
  appPrompt,
  appId,
  onWriteFiles,
}: UseChatProps) {
  const { userRole } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPuterReady, setIsPuterReady] = useState(false);
  const [isSendingFirstMessage, setIsSendingFirstMessage] = useState(false);
  const [selectedApiConfigId, setSelectedApiConfigId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selected_api_config_id');
    }
    return null;
  });
  const [availableKeys, setAvailableKeys] = useState<ApiKey[]>([]);

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
      if (selectedApiConfigId) {
        localStorage.setItem('selected_api_config_id', selectedApiConfigId);
      } else {
        localStorage.removeItem('selected_api_config_id');
      }
    }
  }, [selectedApiConfigId]);

  const getMessagesFromDB = useCallback(async (convId: string) => {
    const { data, error } = await supabase.from('messages').select('id, content, role, model, created_at, conversation_id, type').eq('conversation_id', convId).eq('user_id', userId).order('created_at', { ascending: true });
    if (error) {
      console.error('Error fetching messages:', error);
      toast.error('Error al cargar los mensajes.');
      return [];
    }
    return data.map((msg) => ({
      id: msg.id,
      conversation_id: msg.conversation_id,
      content: msg.content as Message['content'],
      role: msg.role as 'user' | 'assistant',
      model: msg.model || undefined,
      timestamp: new Date(msg.created_at),
      type: msg.type as 'text' | 'multimodal',
    }));
  }, [userId]);

  useEffect(() => {
    const loadConversationData = async () => {
      if (conversationId && userId) {
        setIsLoading(true);
        const fetchedMsgs = await getMessagesFromDB(conversationId);
        if (!isSendingFirstMessage || fetchedMsgs.length > 0) setMessages(fetchedMsgs);
        setIsLoading(false);
      } else {
        setMessages([]);
      }
    };
    loadConversationData();
  }, [conversationId, userId, getMessagesFromDB, isSendingFirstMessage]);

  const createNewConversationInDB = async () => {
    if (!userId) return null;
    const { data, error } = await supabase.from('conversations').insert({ user_id: userId, title: 'Nueva conversación' }).select('id, title').single();
    if (error) {
      toast.error('Error al crear una nueva conversación.');
      return null;
    }
    onNewConversationCreated(data.id);
    onConversationTitleUpdate(data.id, data.title);
    return data.id;
  };

  const saveMessageToDB = async (convId: string, msg: Omit<Message, 'timestamp' | 'id'>) => {
    if (!userId) return null;
    const { data, error } = await supabase.from('messages').insert({ conversation_id: convId, user_id: userId, role: msg.role, content: msg.content as any, model: msg.model, type: msg.type }).select('id, created_at').single();
    if (error) {
      toast.error('Error al guardar el mensaje.');
      return null;
    }
    return { id: data.id, timestamp: new Date(data.created_at) };
  };

  const sendMessage = async (userContent: PuterContentPart[], messageText: string) => {
    if (isLoading || !userId) return;
    if (!selectedApiConfigId) {
      toast.error('Por favor, selecciona un modelo o configuración de API.');
      return;
    }

    let currentConvId = conversationId;
    if (!currentConvId) {
      setIsSendingFirstMessage(true);
      currentConvId = await createNewConversationInDB();
      if (!currentConvId) {
        setIsLoading(false);
        setIsSendingFirstMessage(false);
        return;
      }
    }
    const finalConvId = currentConvId;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      conversation_id: finalConvId,
      content: userContent.length > 1 || userContent.some(p => p.type === 'image_url') ? userContent : messageText,
      role: 'user',
      timestamp: new Date(),
      type: userContent.some(p => p.type === 'image_url') ? 'multimodal' : 'text',
    };
    
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    await saveMessageToDB(finalConvId, userMessage);

    setIsLoading(true);
    const tempTypingId = `assistant-typing-${Date.now()}`;
    setMessages(prev => [...prev, { id: tempTypingId, role: 'assistant', content: '', isTyping: true, timestamp: new Date() }]);

    try {
      const puterProvider = AI_PROVIDERS.find(p => p.source === 'puter');
      const isPuterModel = puterProvider?.models.some(m => m.value === selectedApiConfigId);

      let assistantMessageContent: string;
      let modelUsedForDisplay: string = selectedApiConfigId;

      if (isPuterModel) {
        const puterMessages: PuterMessage[] = newMessages.map(m => ({ role: m.role, content: messageContentToApiFormat(m.content) }));
        const response = await window.puter.ai.chat(puterMessages, { model: selectedApiConfigId });
        if (!response || response.error) throw new Error(response?.error?.message || 'Error de la IA de Puter.');
        assistantMessageContent = response?.message?.content || 'Sin contenido.';
      } else {
        const apiResponse = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: newMessages.map(m => ({ role: m.role, content: messageContentToApiFormat(m.content) })),
            apiKeyId: selectedApiConfigId,
          }),
        });
        const response = await apiResponse.json();
        if (!apiResponse.ok) throw new Error(response.message || 'Error en la API de IA.');
        if (!response || response.error) throw new Error(response?.error?.message || JSON.stringify(response?.error) || 'Error de la IA.');
        assistantMessageContent = response?.message?.content || 'Sin contenido.';
        const keyConfig = availableKeys.find(k => k.id === selectedApiConfigId);
        modelUsedForDisplay = keyConfig?.nickname || keyConfig?.model_name || selectedApiConfigId;
      }

      const parts = parseAiResponseToRenderableParts(assistantMessageContent);
      const filesToWrite: { path: string; content: string }[] = [];
      parts.forEach(part => {
        if (part.type === 'code' && appId && part.filename && part.code) {
          filesToWrite.push({ path: part.filename, content: part.code });
        }
      });

      setMessages(prev => prev.filter(m => m.id !== tempTypingId));

      const assistantMessageData = {
        content: parts,
        role: 'assistant' as const,
        model: modelUsedForDisplay,
        type: 'multimodal' as const,
      };
      const tempId = `assistant-${Date.now()}`;
      setMessages(prev => [...prev, { ...assistantMessageData, id: tempId, timestamp: new Date(), isNew: true }]);
      
      const savedData = await saveMessageToDB(finalConvId, assistantMessageData);
      if (savedData) {
        setMessages(prev => prev.map(msg => msg.id === tempId ? { ...msg, id: savedData.id, timestamp: savedData.timestamp } : msg));
      }

      if (filesToWrite.length > 0) {
        await onWriteFiles(filesToWrite);
      }

    } catch (error: any) {
      let errorMessage = 'Ocurrió un error desconocido.';
      if (error instanceof Error) errorMessage = error.message;
      else if (typeof error === 'string') errorMessage = error;
      else if (error && typeof error === 'object' && error.message) errorMessage = String(error.message);
      
      let rawError = error;
      try { rawError = JSON.parse(errorMessage); } catch (e) { /* Not a JSON string */ }

      const isAdmin = userRole === 'admin' || userRole === 'super_admin';
      const errorMessageForDisplay = isAdmin ? `Error: ${errorMessage}` : 'Error con la IA, se ha enviado un ticket automático.';
      
      if (!isAdmin) {
        fetch('/api/error-tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error_message: rawError, conversation_id: finalConvId }),
        }).catch(apiError => console.error("Failed to submit error ticket:", apiError));
      }

      toast.error(errorMessageForDisplay);
      
      setMessages(prev => {
        const withoutTyping = prev.filter(m => m.id !== tempTypingId);
        if (withoutTyping.length > 0 && withoutTyping[withoutTyping.length - 1].role === 'user') {
            return withoutTyping.slice(0, -1);
        }
        return withoutTyping;
      });

    } finally {
      setIsLoading(false);
      if (!conversationId) setIsSendingFirstMessage(false);
    }
  };

  const regenerateLastResponse = useCallback(async () => {
    if (isLoading) return;
    const lastUserMessageIndex = messages.findLastIndex(m => m.role === 'user');
    if (lastUserMessageIndex === -1) {
      toast.info("No hay nada que regenerar.");
      return;
    }
    const historyForRegen = messages.slice(0, lastUserMessageIndex + 1);
    setMessages(historyForRegen);
    const convId = historyForRegen[0]?.conversation_id;
    if (convId) {
      // This needs to be adapted to the new sendMessage structure
      // For now, we'll just re-send the last message
      const lastUserMessage = historyForRegen[historyForRegen.length - 1];
      const { content } = lastUserMessage;
      let userContent: PuterContentPart[] = [];
      let messageText = '';
      if (typeof content === 'string') {
        messageText = content;
        userContent.push({ type: 'text', text: content });
      } else {
        userContent = content.filter(p => p.type !== 'code') as PuterContentPart[];
        messageText = userContent.filter(p => p.type === 'text').map(p => (p as TextPart).text).join('\n');
      }
      // Re-sending will create a new user message, which is not ideal.
      // A proper implementation would re-use the history.
      // For now, this is a simplified approach.
      // The best way is to call the internal logic directly.
      await sendMessage(userContent, messageText);
    }
  }, [isLoading, messages, sendMessage]);

  const reapplyFilesFromMessage = async (message: Message) => {
    if (!appId) {
      toast.error("No hay un proyecto seleccionado para aplicar los archivos.");
      return;
    }

    const content = message.content;
    const filesToWrite: { path: string; content: string }[] = [];

    if (Array.isArray(content)) {
      content.forEach(part => {
        if (part.type === 'code') {
          if (part.filename && part.code) {
            filesToWrite.push({ path: part.filename, content: part.code });
          }
        }
      });
    }

    if (filesToWrite.length > 0) {
      await onWriteFiles(filesToWrite);
    } else {
      toast.info("No se encontraron archivos para aplicar en este mensaje.");
    }
  };

  return {
    messages,
    isLoading,
    isPuterReady,
    selectedApiKeyId: selectedApiConfigId,
    availableKeys,
    setAvailableKeys,
    handleModelChange: setSelectedApiConfigId,
    sendMessage,
    regenerateLastResponse,
    reapplyFilesFromMessage,
  };
}