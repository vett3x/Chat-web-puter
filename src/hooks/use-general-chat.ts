"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSession } from '@/components/session-context-provider';
import { ApiKey, AiKeyGroup } from '@/hooks/use-user-api-keys'; // Import AiKeyGroup
import { parseAiResponseToRenderableParts, RenderablePart } from '@/lib/utils';
import { AI_PROVIDERS } from '@/lib/ai-models'; // Import AI_PROVIDERS

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

export interface Message {
  id: string;
  conversation_id?: string;
  content: string | RenderablePart[];
  role: 'user' | 'assistant';
  model?: string;
  timestamp: Date;
  isNew: boolean;
  isTyping: boolean;
  type?: 'text' | 'multimodal';
  isConstructionPlan: boolean;
  planApproved: boolean;
  isCorrectionPlan: boolean;
  correctionApproved: boolean;
  isErrorAnalysisRequest: boolean;
  isAnimated: boolean;
}

export type AutoFixStatus = 'idle' | 'analyzing' | 'plan_ready' | 'fixing' | 'failed';

const MESSAGES_PER_PAGE = 30;

// Function to determine the default model based on user preferences and available keys
const determineDefaultModel = (userApiKeys: ApiKey[], aiKeyGroups: AiKeyGroup[]): string => {
  if (typeof window !== 'undefined') {
    const storedDefaultModel = localStorage.getItem('default_ai_model');
    if (storedDefaultModel) {
      // Check if it's a group
      if (storedDefaultModel.startsWith('group:')) {
        const groupId = storedDefaultModel.substring(6);
        const group = aiKeyGroups.find(g => g.id === groupId);
        if (group && group.api_keys?.some(k => k.status === 'active')) {
          return storedDefaultModel;
        }
      }
      // Check if it's an individual key
      if (storedDefaultModel.startsWith('user_key:')) {
        const keyId = storedDefaultModel.substring(9);
        const key = userApiKeys.find(k => k.id === keyId);
        if (key && key.status === 'active') {
          return storedDefaultModel;
        }
      }
      // Check if it's a puter model
      if (storedDefaultModel.startsWith('puter:') && AI_PROVIDERS.some(p => p.models.some(m => `puter:${m.value}` === storedDefaultModel))) {
        return storedDefaultModel;
      }
    }
  }

  // Prioritize global groups with active keys
  const globalGroup = aiKeyGroups.find(g => g.is_global && g.api_keys?.some(k => k.status === 'active'));
  if (globalGroup) {
    return `group:${globalGroup.id}`;
  }

  // Prioritize global individual keys
  const globalKey = userApiKeys.find(key => key.is_global && key.status === 'active');
  if (globalKey) {
    return `user_key:${globalKey.id}`;
  }

  // Then prioritize user's own groups with active keys
  const userGroup = aiKeyGroups.find(g => !g.is_global && g.api_keys?.some(k => k.status === 'active'));
  if (userGroup) {
    return `group:${userGroup.id}`;
  }

  // Then prioritize user's own individual keys
  const userKey = userApiKeys.find(key => !key.is_global && key.status === 'active');
  if (userKey) {
    return `user_key:${userKey.id}`;
  }

  // Then prioritize Claude models
  const claudeModel = AI_PROVIDERS.find(p => p.value === 'anthropic_claude')?.models[0];
  if (claudeModel) {
    return `puter:${claudeModel.value}`;
  }

  // Final fallback if no keys or Puter models are available
  return 'puter:claude-sonnet-4'; // A safe default if nothing else works
};

interface UseGeneralChatProps {
  userId: string | undefined;
  conversationId: string | null;
  onNewConversationCreated: (conversationId: string) => void;
  onConversationTitleUpdate: (conversationId: string, newTitle: string) => void;
  onSidebarDataRefresh: () => void;
  userApiKeys: ApiKey[];
  aiKeyGroups: AiKeyGroup[]; // NEW: Pass aiKeyGroups
  isLoadingApiKeys: boolean;
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

export function useGeneralChat({
  userId,
  conversationId,
  onNewConversationCreated,
  onConversationTitleUpdate,
  onSidebarDataRefresh,
  userApiKeys,
  aiKeyGroups, // NEW: Destructure aiKeyGroups
  isLoadingApiKeys,
}: UseGeneralChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPuterReady, setIsPuterReady] = useState(false);
  const [isSendingFirstMessage, setIsSendingFirstMessage] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(''); // Initialize as empty string
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for debounce
  const [page, setPage] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);

  // NEW: Refs for selectedModel and autoFixStatus
  const selectedModelRef = useRef(selectedModel);
  useEffect(() => { selectedModelRef.current = selectedModel; }, [selectedModel]);
  const autoFixStatusRef = useRef<AutoFixStatus>('idle'); // Initialize ref with default status
  useEffect(() => { autoFixStatusRef.current = 'idle'; }, []); // Reset on mount

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

  useEffect(() => {
    if (isLoadingApiKeys) return;

    const newDefaultModel = determineDefaultModel(userApiKeys, aiKeyGroups); // NEW: Pass aiKeyGroups
    setSelectedModel(newDefaultModel);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selected_ai_model', newDefaultModel);
    }
  }, [isLoadingApiKeys, userApiKeys, aiKeyGroups]); // NEW: Add aiKeyGroups to dependencies


  const getConversationDetails = useCallback(async (convId: string) => {
    const { data, error } = await supabase.from('conversations').select('id, title, model').eq('id', convId).single();
    if (error) {
      console.error('Error fetching conversation details:', error);
      toast.error('Error al cargar los detalles de la conversación.');
      return null;
    }
    return data;
  }, []);

  const getMessagesFromDB = useCallback(async (convId: string, pageToLoad: number) => {
    const from = pageToLoad * MESSAGES_PER_PAGE;
    const to = from + MESSAGES_PER_PAGE - 1;

    const { data, error } = await supabase
      .from('messages')
      .select('id, content, role, model, created_at, conversation_id, type, plan_approved, is_correction_plan, correction_approved')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false }) // Fetch newest first
      .range(from, to);

    if (error) {
      console.error('Error fetching messages:', error);
      toast.error('Error al cargar los mensajes.');
      return [];
    }

    // Reverse the data to have oldest first for rendering
    return data.reverse().map((msg) => ({
      id: msg.id,
      conversation_id: msg.conversation_id,
      content: msg.content as Message['content'],
      role: msg.role as 'user' | 'assistant',
      model: msg.model || undefined,
      timestamp: new Date(msg.created_at),
      type: msg.type as 'text' | 'multimodal',
      isConstructionPlan: typeof msg.content === 'string' && msg.content.includes('### 1. Análisis del Requerimiento'),
      planApproved: msg.plan_approved || false,
      isCorrectionPlan: msg.is_correction_plan || false,
      correctionApproved: msg.correction_approved || false,
      isErrorAnalysisRequest: typeof msg.content === 'string' && msg.content.includes('### 💡 Entendido!'),
      isNew: false,
      isTyping: false,
      isAnimated: true,
    }));
  }, []);

  const saveMessageToDB = async (convId: string, msg: Omit<Message, 'timestamp' | 'id'>) => {
    if (!userId) return null;
    const { data, error } = await supabase.from('messages').insert({ 
      conversation_id: convId, 
      user_id: userId, 
      role: msg.role, 
      content: msg.content as any, 
      model: msg.model, 
      type: msg.type,
      plan_approved: msg.planApproved,
      is_correction_plan: msg.isCorrectionPlan,
      correction_approved: msg.correctionApproved,
    }).select('id, created_at').single();
    if (error) {
      toast.error('Error al guardar el mensaje.');
      return null;
    }
    return { id: data.id, timestamp: new Date(data.created_at) };
  };

  const getAndStreamAIResponse = useCallback(async (convId: string, history: Message[]) => {
    setIsLoading(true);
    const assistantMessageId = `assistant-${Date.now()}`;
    
    setMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: '', isTyping: true, isNew: true, isConstructionPlan: false, planApproved: false, isCorrectionPlan: false, correctionApproved: false, isErrorAnalysisRequest: false, isAnimated: false, timestamp: new Date() }]);
    
    const userMessages = history.filter(m => m.role === 'user');
    const userMessageToSave = userMessages.length > 0 ? userMessages[userMessages.length - 1] : undefined;
    if (userMessageToSave) {
      await saveMessageToDB(convId, userMessageToSave);
    }

    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined = undefined;

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error('La IA tardó demasiado en responder. Por favor, inténtalo de nuevo.'));
      }, 120000); // Increased timeout to 2 minutes
    });

    try {
      const systemPromptContent = ""; 

      const messagesForApi = history.map(msg => ({
        role: msg.role,
        content: messageContentToApiFormat(msg.content),
      }));
      
      const systemMessage: PuterMessage = { role: 'system', content: systemPromptContent };
      const finalMessagesForApi = [systemMessage, ...messagesForApi];

      let fullResponseText = '';
      let modelUsedForResponse = selectedModelRef.current; // Use ref here

      const selectedKey = userApiKeys.find(k => `user_key:${k.id}` === selectedModelRef.current); // Use ref here
      const isCustomEndpoint = selectedKey?.provider === 'custom_endpoint';

      if (selectedModelRef.current.startsWith('puter:') || isCustomEndpoint || selectedModelRef.current.startsWith('group:')) { // NEW: Check for group selection
        let response;
        if (isCustomEndpoint || selectedModelRef.current.startsWith('group:')) { // NEW: If group or custom endpoint, use API route
          const apiResponse = await Promise.race([
            fetch('/api/ai/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: finalMessagesForApi,
                selectedKeyId: selectedModelRef.current.substring(selectedModelRef.current.indexOf(':') + 1), // Pass key ID or group ID
                stream: false,
              }),
              signal: controller.signal,
            }),
            timeoutPromise
          ]);
          if (apiResponse instanceof Response) {
            response = await apiResponse.json();
            if (!apiResponse.ok) throw new Error(response.message || 'Error en la API de IA.');
          } else {
            throw new Error('Respuesta inesperada del endpoint personalizado.');
          }
        } else {
          const actualModelForPuter = selectedModelRef.current.substring(6); // Use ref here
          response = await Promise.race([
            window.puter.ai.chat(finalMessagesForApi, { model: actualModelForPuter }),
            timeoutPromise
          ]);
        }
        if (!response || response.error) throw new Error(response?.error?.message || JSON.stringify(response?.error) || 'Error de la IA.');
        fullResponseText = response?.message?.content || 'Sin contenido.';
      } else if (selectedModelRef.current.startsWith('user_key:')) { // Use ref here
        const apiResponse = await Promise.race([
          fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: finalMessagesForApi,
              selectedKeyId: selectedModelRef.current.substring(9), // Use ref here
              stream: true,
            }),
            signal: controller.signal,
          }),
          timeoutPromise
        ]);
        if (apiResponse instanceof Response) {
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
          throw new Error('Respuesta inesperada del endpoint de streaming.');
        }
      } else {
        throw new Error('Modelo de IA no válido seleccionado.');
      }
      
      const finalContentForMessage = parseAiResponseToRenderableParts(fullResponseText, false);
      
      const finalAssistantMessageData: Omit<Message, 'timestamp' | 'id'> = {
        content: finalContentForMessage,
        role: 'assistant' as const,
        model: modelUsedForResponse,
        type: 'multimodal' as const,
        isConstructionPlan: false,
        planApproved: false,
        isCorrectionPlan: false,
        correctionApproved: false,
        isErrorAnalysisRequest: false,
        isNew: true,
        isTyping: false,
        isAnimated: false,
      };

      const savedData = await saveMessageToDB(convId, finalAssistantMessageData);
      setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, ...finalAssistantMessageData, id: savedData?.id || assistantMessageId, timestamp: savedData?.timestamp || new Date() } : m));

    } catch (error: any) {
      console.error('[API /ai/chat] Error:', error);
      let userFriendlyMessage = `Error en la API de IA: ${error.name === 'AbortError' ? 'La IA tardó demasiado en responder.' : error.message}`;
      setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: userFriendlyMessage, isTyping: false, isNew: true, isConstructionPlan: false, planApproved: false, isCorrectionPlan: false, isErrorAnalysisRequest: false, isAnimated: false } : m));
      toast.error(userFriendlyMessage);
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, [userId, saveMessageToDB, userApiKeys, aiKeyGroups]); // NEW: Add aiKeyGroups to dependencies

  const loadConversationData = useCallback(async () => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(async () => {
      if (conversationId && userId) {
        setIsLoading(true);
        setMessages([]);
        setPage(0);
        setHasMoreMessages(true);
        
        const details = await getConversationDetails(conversationId);
        
        if (details?.model && (details.model.startsWith('puter:') || details.model.startsWith('user_key:') || details.model.startsWith('group:'))) { // NEW: Check for group model
          setSelectedModel(details.model);
        } else {
          setSelectedModel(determineDefaultModel(userApiKeys, aiKeyGroups)); // NEW: Pass aiKeyGroups
        }

        const fetchedMsgs = await getMessagesFromDB(conversationId, 0);
        setMessages(fetchedMsgs);
        if (fetchedMsgs.length < MESSAGES_PER_PAGE) {
          setHasMoreMessages(false);
        }
        setIsLoading(false);
      } else {
        setMessages([]);
      }
    }, 100);
  }, [conversationId, userId, getMessagesFromDB, getConversationDetails, userApiKeys, aiKeyGroups]); // NEW: Add aiKeyGroups to dependencies

  const loadMoreMessages = useCallback(async () => {
    if (!conversationId || !hasMoreMessages || isLoading) return;

    const nextPage = page + 1;
    const olderMessages = await getMessagesFromDB(conversationId, nextPage);

    if (olderMessages.length > 0) {
      setMessages(prev => [...olderMessages, ...prev]);
      setPage(nextPage);
    }
    if (olderMessages.length < MESSAGES_PER_PAGE) {
      setHasMoreMessages(false);
    }
  }, [conversationId, hasMoreMessages, isLoading, page, getMessagesFromDB]);

  useEffect(() => {
    loadConversationData();
  }, [loadConversationData]);

  const createNewConversationInDB = async () => {
    if (!userId) return null;
    const { data, error } = await supabase.from('conversations').insert({ user_id: userId, title: 'Nueva conversación', model: selectedModelRef.current }).select('id, title').single(); // Use ref here
    if (error) {
      toast.error('Error al crear una nueva conversación.');
      return null;
    }
    onNewConversationCreated(data.id);
    onConversationTitleUpdate(data.id, data.title);
    onSidebarDataRefresh();
    return data.id;
  };

  const updateConversationModelInDB = async (convId: string, model: string) => {
    if (!userId) return;
    const { error } = await supabase.from('conversations').update({ model }).eq('id', convId);
    if (error) toast.error('Error al actualizar el modelo de la conversación.');
  };

  const handleModelChange = (modelValue: string) => {
    setSelectedModel(modelValue);
    if (conversationId) updateConversationModelInDB(conversationId, modelValue);
  };

  const sendMessage = useCallback(async (content: PuterContentPart[], messageText: string) => {
    if (!userId) {
      toast.error('No hay usuario autenticado.');
      return;
    }

    let currentConversationId = conversationId;
    if (!currentConversationId) {
      setIsSendingFirstMessage(true);
      currentConversationId = await createNewConversationInDB();
      if (!currentConversationId) {
        setIsSendingFirstMessage(false);
        return;
      }
    }

    const newUserMessage: Message = {
      id: `user-${Date.now()}`,
      conversation_id: currentConversationId,
      content: content,
      role: 'user',
      timestamp: new Date(),
      type: content.some(part => part.type === 'image_url') ? 'multimodal' : 'text',
      isNew: true,
      isTyping: false,
      isConstructionPlan: false,
      planApproved: false,
      isCorrectionPlan: false,
      correctionApproved: false,
      isErrorAnalysisRequest: false,
      isAnimated: false,
    };

    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    await getAndStreamAIResponse(currentConversationId, [...messages, newUserMessage]);
    setIsSendingFirstMessage(false);
  }, [userId, conversationId, messages, createNewConversationInDB, getAndStreamAIResponse]);

  const regenerateLastResponse = useCallback(async () => {
    if (isLoading) return;
    
    let lastUserMessageIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserMessageIndex = i;
        break;
      }
    }

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
  }, [isLoading, messages, getAndStreamAIResponse]);

  const clearChat = useCallback(async () => {
    if (!conversationId || !userId) {
      toast.error('No hay una conversación seleccionada o usuario autenticado.');
      return;
    }
    setIsLoading(true);
    try {
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);

      if (messagesError) {
        console.error('Supabase Error clearing messages in useGeneralChat:', messagesError);
        throw new Error(messagesError.message);
      }

      const { error: conversationError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (conversationError) {
        console.error('Supabase Error clearing conversation in useGeneralChat:', conversationError);
        throw new Error(conversationError.message);
      }

      setMessages([]);
      toast.success('Chat limpiado correctamente.');
    } catch (error: any) {
      console.error('Error al limpiar el chat:', error);
      toast.error(`Error al limpiar el chat: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, userId]);

  const approvePlan = useCallback(async (messageId: string) => {
    toast.info("Esta acción no está disponible en el chat general.");
  }, []);
  const reapplyFilesFromMessage = useCallback(async (message: Message) => {
    toast.info("Esta acción no está disponible en el chat general.");
  }, []);
  const triggerFixBuildError = useCallback(async () => {
    toast.info("Esta acción no está disponible en el chat general.");
  }, []);
  const triggerReportWebError = useCallback(async () => {
    toast.info("Esta acción no está disponible en el chat general.");
  }, []);

  return {
    messages,
    isLoading,
    isPuterReady,
    selectedModel,
    handleModelChange,
    sendMessage,
    regenerateLastResponse,
    reapplyFilesFromMessage,
    clearChat,
    approvePlan,
    autoFixStatus: 'idle' as AutoFixStatus,
    triggerFixBuildError,
    triggerReportWebError,
    loadConversationData,
    loadMoreMessages,
    hasMoreMessages,
  };
}