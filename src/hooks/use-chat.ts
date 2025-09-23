"use client";

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSession } from '@/components/session-context-provider';

// Define types
interface PuterTextContentPart {
  type: 'text';
  text: string;
}

interface PuterImageContentPart {
  type: 'image_url';
  image_url: {
    url: string;
  };
}

type PuterContentPart = PuterTextContentPart | PuterImageContentPart;

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

interface Message {
  id: string;
  conversation_id?: string;
  content: string | PuterContentPart[];
  role: 'user' | 'assistant';
  model?: string;
  timestamp: Date;
  isNew?: boolean;
  isTyping?: boolean;
  type?: 'text' | 'multimodal';
}

const DEFAULT_AI_MODEL = 'claude-sonnet-4';

interface UseChatProps {
  userId: string | undefined;
  conversationId: string | null;
  onNewConversationCreated: (conversationId: string) => void;
  onConversationTitleUpdate: (conversationId: string, newTitle: string) => void;
  appPrompt?: string | null;
  appId?: string | null;
  onFilesWritten?: () => void;
}

const codeBlockRegex = /```(\w+)?(?::([\w./-]+))?\s*\n([\s\S]*?)\s*```/g;

// This is a more flexible type for our internal rendering logic
interface RenderablePart {
  type: 'text' | 'code';
  text?: string;
  language?: string;
  filename?: string;
  code?: string;
}

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
    parts.push({
      type: 'code',
      language: match[1] || '',
      filename: match[2],
      code: (match[3] || '').trim(),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const textPart = content.substring(lastIndex).trim();
    if (textPart) parts.push({ type: 'text', text: textPart });
  }

  return parts.length > 0 ? parts : [{ type: 'text', text: content }];
}


export function useChat({
  userId,
  conversationId,
  onNewConversationCreated,
  onConversationTitleUpdate,
  appPrompt,
  appId,
  onFilesWritten,
}: UseChatProps) {
  const { userRole } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPuterReady, setIsPuterReady] = useState(false);
  const [isSendingFirstMessage, setIsSendingFirstMessage] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selected_ai_model') || DEFAULT_AI_MODEL;
    }
    return DEFAULT_AI_MODEL;
  });

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
      localStorage.setItem('selected_ai_model', selectedModel);
    }
  }, [selectedModel]);

  const getConversationDetails = useCallback(async (convId: string) => {
    const { data, error } = await supabase.from('conversations').select('id, title, model').eq('id', convId).eq('user_id', userId).single();
    if (error) {
      console.error('Error fetching conversation details:', error);
      toast.error('Error al cargar los detalles de la conversación.');
      return null;
    }
    return data;
  }, [userId]);

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
      content: msg.content,
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
        const details = await getConversationDetails(conversationId);
        if (details?.model) setSelectedModel(details.model);
        else setSelectedModel(localStorage.getItem('selected_ai_model') || DEFAULT_AI_MODEL);
        const fetchedMsgs = await getMessagesFromDB(conversationId);
        if (!isSendingFirstMessage || fetchedMsgs.length > 0) setMessages(fetchedMsgs);
        setIsLoading(false);
      } else {
        setMessages([]);
        setSelectedModel(localStorage.getItem('selected_ai_model') || DEFAULT_AI_MODEL);
      }
    };
    loadConversationData();
  }, [conversationId, userId, getMessagesFromDB, getConversationDetails, isSendingFirstMessage]);

  const createNewConversationInDB = async () => {
    if (!userId) return null;
    const { data, error } = await supabase.from('conversations').insert({ user_id: userId, title: 'Nueva conversación', model: selectedModel }).select('id, title').single();
    if (error) {
      toast.error('Error al crear una nueva conversación.');
      return null;
    }
    onNewConversationCreated(data.id);
    onConversationTitleUpdate(data.id, data.title);
    return data.id;
  };

  const updateConversationModelInDB = async (convId: string, model: string) => {
    if (!userId) return;
    const { error } = await supabase.from('conversations').update({ model }).eq('id', convId).eq('user_id', userId);
    if (error) toast.error('Error al actualizar el modelo de la conversación.');
  };

  const handleModelChange = (modelValue: string) => {
    setSelectedModel(modelValue);
    if (conversationId) updateConversationModelInDB(conversationId, modelValue);
  };

  const saveMessageToDB = async (convId: string, msg: Omit<Message, 'timestamp' | 'id'>) => {
    if (!userId) return null;
    const { data, error } = await supabase.from('messages').insert({ conversation_id: convId, user_id: userId, role: msg.role, content: msg.content, model: msg.model, type: msg.type }).select('id, created_at').single();
    if (error) {
      toast.error('Error al guardar el mensaje.');
      return null;
    }
    return { id: data.id, timestamp: new Date(data.created_at) };
  };

  const writeFilesToApp = async (files: { path: string; content: string }[]) => {
    if (!appId || files.length === 0) return;
    toast.info(`Aplicando ${files.length} archivo(s) al proyecto...`);
    try {
      const promises = files.map(file =>
        fetch(`/api/apps/${appId}/file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(file),
        })
      );
      const responses = await Promise.all(promises);
      const failed = responses.filter(res => !res.ok);
      if (failed.length > 0) {
        throw new Error(`${failed.length} archivo(s) no se pudieron guardar.`);
      }
      toast.success('¡Archivos aplicados! Actualizando vista previa...');
      onFilesWritten?.();
    } catch (error: any) {
      toast.error(`Error al aplicar archivos: ${error.message}`);
    }
  };

  const getAndStreamAIResponse = async (convId: string, history: Message[]) => {
    setIsLoading(true);
    const tempTypingId = `assistant-typing-${Date.now()}`;
    setMessages(prev => [...prev, { id: tempTypingId, role: 'assistant', content: '', isTyping: true, timestamp: new Date() }]);
    
    const userMessageToSave = history.findLast(m => m.role === 'user');

    try {
      const puterMessages: PuterMessage[] = history.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));
      
      let systemMessage: PuterMessage;
      if (appPrompt) {
        systemMessage = {
          role: 'system',
          content: `Eres un desarrollador experto en Next.js (App Router), TypeScript y Tailwind CSS. Tu tarea es generar los archivos necesarios para construir la aplicación que el usuario ha descrito: "${appPrompt}".
          REGLAS ESTRICTAS:
          1. Responde ÚNICAMENTE con bloques de código.
          2. Cada bloque de código DEBE representar un archivo completo.
          3. Usa el formato \`\`\`language:ruta/del/archivo.tsx\`\`\` para cada bloque.
          4. NO incluyas ningún texto conversacional, explicaciones, saludos o introducciones. Solo el código.`
        };
      } else {
        systemMessage = {
          role: 'system',
          content: "Cuando generes un bloque de código, siempre debes especificar el lenguaje y un nombre de archivo descriptivo. Usa el formato ```language:filename.ext. Por ejemplo: ```python:chess_game.py. Esto es muy importante."
        };
      }

      const response = await window.puter.ai.chat([systemMessage, ...puterMessages], { model: selectedModel });
      if (!response || response.error) throw new Error(response?.error?.message || JSON.stringify(response?.error) || 'Error de la IA.');

      // --- On Success ---
      if (userMessageToSave) {
        await saveMessageToDB(convId, userMessageToSave);
      }

      const assistantMessageContent = response?.message?.content || 'Sin contenido.';
      
      let contentToParse: string;
      if (typeof assistantMessageContent === 'string') {
        contentToParse = assistantMessageContent;
      } else if (Array.isArray(assistantMessageContent) && assistantMessageContent[0]?.type === 'text') {
        contentToParse = assistantMessageContent[0].text;
      } else {
        contentToParse = JSON.stringify(assistantMessageContent);
      }

      const parts = parseAiResponseToRenderableParts(contentToParse);
      const filesToWrite: { path: string; content: string }[] = [];

      parts.forEach(part => {
        if (part.type === 'code' && appId && part.filename && part.code) {
          filesToWrite.push({ path: part.filename, content: part.code });
        }
      });

      setMessages(prev => prev.filter(m => m.id !== tempTypingId));

      const assistantMessageData = {
        content: parts as any,
        role: 'assistant' as const,
        model: selectedModel,
        type: 'multimodal' as const,
      };
      const tempId = `assistant-${Date.now()}`;
      setMessages(prev => [...prev, { ...assistantMessageData, id: tempId, timestamp: new Date(), isNew: true }]);
      
      const savedData = await saveMessageToDB(convId, assistantMessageData);
      if (savedData) {
        setMessages(prev => prev.map(msg => msg.id === tempId ? { ...msg, id: savedData.id, timestamp: savedData.timestamp } : msg));
      }

      if (filesToWrite.length > 0) {
        await writeFilesToApp(filesToWrite);
      }

    } catch (error: any) {
      // --- On Failure ---
      let rawError = error;
      try {
        rawError = JSON.parse(error.message);
      } catch (e) { /* Not a JSON string, use as is */ }

      let errorMessageForDisplay: string;
      const isAdmin = userRole === 'admin' || userRole === 'super_admin';

      if (isAdmin) {
        errorMessageForDisplay = `Error: ${error.message}`;
      } else {
        errorMessageForDisplay = 'Error con la IA, se ha enviado un ticket automático.';
        fetch('/api/error-tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error_message: rawError, conversation_id: convId }),
        }).catch(apiError => console.error("Failed to submit error ticket:", apiError));
      }

      toast.error(errorMessageForDisplay);
      
      // Remove the "typing" indicator AND the user's last message from the UI
      setMessages(prev => {
        const withoutTyping = prev.filter(m => m.id !== tempTypingId);
        // The last message should be the user's message that failed. Remove it.
        if (withoutTyping.length > 0 && withoutTyping[withoutTyping.length - 1].role === 'user') {
            return withoutTyping.slice(0, -1);
        }
        return withoutTyping;
      });

    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (userContent: PuterContentPart[], messageText: string) => {
    if (isLoading || !isPuterReady || !userId) return;

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
    
    // Message is NOT saved to DB here. It's saved on successful AI response.
    await getAndStreamAIResponse(finalConvId, newMessages);
    
    if (!conversationId) setIsSendingFirstMessage(false);
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
      await getAndStreamAIResponse(convId, historyForRegen);
    }
  }, [isLoading, messages]);

  const reapplyFilesFromMessage = async (message: Message) => {
    if (!appId) {
      toast.error("No hay un proyecto seleccionado para aplicar los archivos.");
      return;
    }

    const content = message.content;
    const filesToWrite: { path: string; content: string }[] = [];

    if (Array.isArray(content)) {
      content.forEach(part => {
        const renderablePart = part as RenderablePart;
        if (renderablePart.type === 'code' && renderablePart.filename && renderablePart.code) {
          filesToWrite.push({ path: renderablePart.filename, content: renderablePart.code });
        }
      });
    }

    if (filesToWrite.length > 0) {
      await writeFilesToApp(filesToWrite);
    } else {
      toast.info("No se encontraron archivos para aplicar en este mensaje.");
    }
  };

  return {
    messages,
    isLoading,
    isPuterReady,
    selectedModel,
    handleModelChange,
    sendMessage,
    regenerateLastResponse,
    reapplyFilesFromMessage,
  };
}