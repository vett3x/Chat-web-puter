"use client";

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
}

export function useChat({
  userId,
  conversationId,
  onNewConversationCreated,
  onConversationTitleUpdate,
}: UseChatProps) {
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
    const { data, error } = await supabase
      .from('conversations')
      .select('id, title, model')
      .eq('id', convId)
      .eq('user_id', userId)
      .single();
    if (error) {
      console.error('Error fetching conversation details:', error);
      toast.error('Error al cargar los detalles de la conversación.');
      return null;
    }
    return data;
  }, [userId]);

  const getMessagesFromDB = useCallback(async (convId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('id, content, role, model, created_at, conversation_id, type')
      .eq('conversation_id', convId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
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
        if (details?.model) {
          setSelectedModel(details.model);
        } else {
          setSelectedModel(localStorage.getItem('selected_ai_model') || DEFAULT_AI_MODEL);
        }
        const fetchedMsgs = await getMessagesFromDB(conversationId);
        if (!isSendingFirstMessage || fetchedMsgs.length > 0) {
          setMessages(fetchedMsgs);
        }
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
    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: userId, title: 'Nueva conversación', model: selectedModel })
      .select('id, title')
      .single();
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
    const { error } = await supabase
      .from('conversations')
      .update({ model })
      .eq('id', convId)
      .eq('user_id', userId);
    if (error) toast.error('Error al actualizar el modelo de la conversación.');
  };

  const handleModelChange = (modelValue: string) => {
    setSelectedModel(modelValue);
    if (conversationId) {
      updateConversationModelInDB(conversationId, modelValue);
    }
  };

  const saveMessageToDB = async (convId: string, msg: Omit<Message, 'timestamp' | 'id'>) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: convId,
        user_id: userId,
        role: msg.role,
        content: msg.content,
        model: msg.model,
        type: msg.type,
      })
      .select('id, created_at')
      .single();
    if (error) {
      toast.error('Error al guardar el mensaje.');
      return null;
    }
    return { id: data.id, timestamp: new Date(data.created_at) };
  };

  const sendMessage = async (userContent: PuterContentPart[], messageText: string) => {
    if (isLoading || !isPuterReady || !userId) return;

    setIsLoading(true);
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
    setMessages(prev => [...prev, userMessage]);

    const tempAssistantId = `assistant-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: tempAssistantId,
      conversation_id: finalConvId,
      content: '',
      role: 'assistant',
      model: selectedModel,
      timestamp: new Date(),
      isTyping: true,
      type: 'text',
    }]);

    try {
      const { data: historyData } = await supabase
        .from('messages')
        .select('content, role, type')
        .eq('conversation_id', finalConvId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      const puterMessages: PuterMessage[] = (historyData || []).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content as string | PuterContentPart[],
      }));
      
      const systemMessage: PuterMessage = {
        role: 'system',
        content: "Cuando generes un bloque de código, siempre debes especificar el lenguaje y un nombre de archivo descriptivo. Usa el formato ```language:filename.ext. Por ejemplo: ```python:chess_game.py. Esto es muy importante."
      };

      const response = await window.puter.ai.chat([systemMessage, ...puterMessages, { role: 'user', content: userContent }], { model: selectedModel });

      if (!response || response.error) throw new Error(response?.error?.message || 'Error de la IA.');

      const assistantMessageContent = response?.message?.content || 'Sin contenido.';
      const assistantMessageType: 'text' | 'multimodal' = Array.isArray(assistantMessageContent) ? 'multimodal' : 'text';

      const assistantMessageData = {
        content: assistantMessageContent,
        role: 'assistant' as const,
        model: selectedModel,
        type: assistantMessageType,
      };

      setMessages(prev => prev.map(msg => msg.id === tempAssistantId ? { ...msg, ...assistantMessageData, isTyping: false, isNew: true } : msg));

      await saveMessageToDB(finalConvId, userMessage);
      saveMessageToDB(finalConvId, assistantMessageData).then(savedData => {
        if (savedData) {
          setMessages(prev => prev.map(msg => msg.id === tempAssistantId ? { ...msg, id: savedData.id, timestamp: savedData.timestamp } : msg));
        }
      });
    } catch (error: any) {
      toast.error(error.message);
      setMessages(prev => prev.map(msg => msg.id === tempAssistantId ? { ...msg, content: `Error: ${error.message}`, isTyping: false, isNew: true } : msg));
    } finally {
      setIsLoading(false);
      if (!conversationId) setIsSendingFirstMessage(false);
    }
  };

  return {
    messages,
    isLoading,
    isPuterReady,
    selectedModel,
    handleModelChange,
    sendMessage,
  };
}