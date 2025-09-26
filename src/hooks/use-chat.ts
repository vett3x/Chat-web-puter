"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useSession } from '@/components/session-context-provider';
import { AI_PROVIDERS } from '@/lib/ai-models';
import { ApiKey } from '@/hooks/use-user-api-keys';
import { ChatMode } from '@/components/chat/chat-input';
import { parseAiResponseToRenderableParts, RenderablePart } from '@/lib/utils';
import { Message, AutoFixStatus, PuterMessage, PuterContentPart } from '@/types/chat';
import * as chatDbService from '@/lib/services/chat-db-service';
import { buildSystemPrompt } from '@/lib/services/prompt-builder';

declare global {
  interface Window { puter: { ai: { chat: (messages: PuterMessage[], options: { model: string, stream?: boolean }) => Promise<any>; }; }; }
}

const DEFAULT_AI_MODEL_FALLBACK = 'puter:claude-sonnet-4';

interface UseChatProps {
  userId: string | undefined;
  conversationId: string | null;
  onNewConversationCreated: (conversationId: string) => void;
  onConversationTitleUpdate: (conversationId: string, newTitle: string) => void;
  appPrompt?: string | null;
  appId?: string | null;
  onWriteFiles: (files: { path: string; content: string }[]) => Promise<void>;
  onSidebarDataRefresh: () => void;
  userApiKeys: ApiKey[];
  isLoadingApiKeys: boolean;
  chatMode: ChatMode;
}

// Helper to assert a part is a CodePart
interface CodePart {
  type: 'code';
  language?: string;
  filename?: string;
  code?: string;
}

function messageContentToApiFormat(content: Message['content']): string | PuterContentPart[] {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.map((part) => {
            if (part.type === 'text') return { type: 'text', text: part.text };
            if (part.type === 'code') return { type: 'text', text: `\`\`\`${part.language || ''}${part.filename ? `:${part.filename}` : ''}\n${part.code || ''}\n\`\`\`` };
            if (part.type === 'image_url') return part;
            return { type: 'text', text: '' };
        }).filter(Boolean) as PuterContentPart[];
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
  onSidebarDataRefresh,
  userApiKeys,
  isLoadingApiKeys,
  chatMode,
}: UseChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPuterReady, setIsPuterReady] = useState(false);
  const [isSendingFirstMessage, setIsSendingFirstMessage] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_AI_MODEL_FALLBACK);
  const [autoFixStatus, setAutoFixStatus] = useState<AutoFixStatus>('idle');
  const autoFixAttempts = useRef(0);

  useEffect(() => {
    const checkPuter = () => {
      if (typeof window !== 'undefined' && window.puter) setIsPuterReady(true);
      else setTimeout(checkPuter, 100);
    };
    checkPuter();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedModel = localStorage.getItem('selected_ai_model');
      if (storedModel) setSelectedModel(storedModel);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('selected_ai_model', selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    const loadConversationData = async () => {
      if (conversationId && userId) {
        setIsLoading(true);
        try {
          const details = await chatDbService.fetchConversationDetails(conversationId, userId);
          if (details?.model) setSelectedModel(details.model);
          const fetchedMsgs = await chatDbService.fetchMessages(conversationId, userId);
          setMessages(fetchedMsgs);
        } catch (error) {
          console.error("Error loading conversation data:", error);
          toast.error("Error al cargar los datos de la conversación.");
          setMessages([]); // Clear messages on error
        } finally {
          setIsLoading(false);
        }
      } else {
        setMessages([]);
      }
    };
    loadConversationData();
  }, [conversationId, userId]); // Dependencies simplified

  const handleModelChange = (modelValue: string) => {
    setSelectedModel(modelValue);
    if (conversationId && userId) chatDbService.updateConversationModel(conversationId, userId, modelValue);
  };

  const getAndStreamAIResponse = useCallback(async (convId: string, history: Message[]) => {
    setIsLoading(true);
    const assistantMessageId = `assistant-${Date.now()}`;
    setMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: '', isTyping: true, isNew: true, isConstructionPlan: false, planApproved: false, isCorrectionPlan: false, correctionApproved: false, isAnimated: false, timestamp: new Date() }]);
    
    const userMessageToSave = history.findLast(m => m.role === 'user');
    if (userMessageToSave && userId) await chatDbService.saveMessage(convId, userId, userMessageToSave);

    try {
      const systemPromptContent = buildSystemPrompt(appPrompt, chatMode);
      const systemMessage: PuterMessage = { role: 'system', content: systemPromptContent };
      const messagesForApi = history.map(msg => ({ role: msg.role, content: messageContentToApiFormat(msg.content) }));

      let fullResponseText = '';
      const isAppChatModeBuild = !!appPrompt && chatMode === 'build';

      if (selectedModel.startsWith('puter:')) {
        const response = await window.puter.ai.chat([systemMessage, ...messagesForApi], { model: selectedModel.substring(6) });
        if (!response || response.error) throw new Error(response?.error?.message || 'Error de la IA.');
        fullResponseText = response?.message?.content || 'Sin contenido.';
      } else if (selectedModel.startsWith('user_key:')) {
        const apiResponse = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [systemMessage, ...messagesForApi], selectedKeyId: selectedModel.substring(9), stream: true }),
        });
        if (!apiResponse.ok || !apiResponse.body) {
          const errorData = await apiResponse.json();
          throw new Error(errorData.message || 'Error en la API de IA.');
        }
        const reader = apiResponse.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullResponseText += decoder.decode(value, { stream: true });
          if (!isAppChatModeBuild || !fullResponseText.includes('### 1. Análisis del Requerimiento')) {
            setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: parseAiResponseToRenderableParts(fullResponseText, isAppChatModeBuild), isTyping: false, isNew: true } : m));
          }
        }
      } else {
        throw new Error('Modelo de IA no válido seleccionado.');
      }

      const isConstructionPlan = isAppChatModeBuild && fullResponseText.includes('### 1. Análisis del Requerimiento');
      const finalContent = isConstructionPlan ? fullResponseText : parseAiResponseToRenderableParts(fullResponseText, isAppChatModeBuild);
      
      const finalAssistantMessage: Omit<Message, 'id' | 'timestamp'> = {
        content: finalContent,
        role: 'assistant',
        model: selectedModel,
        isNew: true,
        isTyping: false,
        isConstructionPlan,
        planApproved: false,
        isCorrectionPlan: false,
        correctionApproved: false,
        isAnimated: false,
      };

      if (userId) {
        const savedData = await chatDbService.saveMessage(convId, userId, finalAssistantMessage);
        setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, ...finalAssistantMessage, id: savedData?.id || assistantMessageId, timestamp: savedData?.timestamp || new Date() } : m));
      }

      if (isAppChatModeBuild && !isConstructionPlan && Array.isArray(finalContent)) {
        const filesToWrite = finalContent.filter((p): p is CodePart => p.type === 'code' && !!p.filename && !!p.code).map(p => ({ path: p.filename!, content: p.code! }));
        if (filesToWrite.length > 0) await onWriteFiles(filesToWrite);
      }

    } catch (error: any) {
      console.error('[useChat] Error:', error);
      const errorMessage = `Error en la API de IA: ${error.message}`;
      setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: errorMessage, isTyping: false, isNew: true, isConstructionPlan: false, planApproved: false, isCorrectionPlan: false, correctionApproved: false, isAnimated: false } : m));
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [appPrompt, chatMode, selectedModel, userId, onWriteFiles, userApiKeys]);

  const sendMessage = useCallback(async (content: PuterContentPart[], messageText: string) => {
    if (!userId) return toast.error('No hay usuario autenticado.');
    
    setIsLoading(true); // Start loading immediately
    setIsSendingFirstMessage(true); // Indicate that we are sending the first message for a potentially new conv

    let currentConversationId: string; // Declare as string
    try {
      if (!conversationId) { // If no existing conversationId is provided
        const newConv = await chatDbService.createConversation(userId, selectedModel);
        if (!newConv) {
          setIsSendingFirstMessage(false);
          toast.error('Fallo al crear una nueva conversación.'); // Notify user
          return; // Exit if conversation creation failed
        }
        currentConversationId = newConv.id; // newConv.id is guaranteed to be string here
        onNewConversationCreated(currentConversationId);
        onConversationTitleUpdate(currentConversationId, newConv.title);
        onSidebarDataRefresh();
      } else {
        currentConversationId = conversationId; // Use the existing conversationId
      }

      const newUserMessage: Message = {
        id: `user-${Date.now()}`,
        conversation_id: currentConversationId,
        content,
        role: 'user',
        timestamp: new Date(),
        type: content.some(part => part.type === 'image_url') ? 'multimodal' : 'text',
        isNew: true,
        isTyping: false,
        isConstructionPlan: false,
        planApproved: false,
        isCorrectionPlan: false,
        correctionApproved: false,
        isAnimated: true,
      };

      setMessages(prev => [...prev, newUserMessage]); // Optimistic update

      await getAndStreamAIResponse(currentConversationId, [...messages, newUserMessage]); // Pass updated history
    } catch (error: any) {
      toast.error(`Error al enviar mensaje: ${error.message}`);
      setMessages(prev => prev.filter(msg => msg.id !== `user-${Date.now()}`)); // Rollback optimistic user message
    } finally {
      setIsLoading(false); // Ensure loading is false
      setIsSendingFirstMessage(false); // Reset this flag
    }
  }, [userId, conversationId, messages, selectedModel, getAndStreamAIResponse, onNewConversationCreated, onConversationTitleUpdate, onSidebarDataRefresh]);

  const approvePlan = useCallback(async (messageId: string) => {
    if (!conversationId) return;
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, planApproved: true } : m));
    const approvalMessage: Message = {
      id: `user-approval-${Date.now()}`,
      conversation_id: conversationId,
      content: '[USER_APPROVED_PLAN]',
      role: 'user',
      timestamp: new Date(),
      type: 'text',
      isNew: true,
      isTyping: false,
      isConstructionPlan: false,
      planApproved: false,
      isCorrectionPlan: false,
      correctionApproved: false,
      isAnimated: true,
    };
    await getAndStreamAIResponse(conversationId, [...messages, approvalMessage]);
  }, [messages, conversationId, getAndStreamAIResponse]);

  const regenerateLastResponse = useCallback(async () => {
    if (isLoading || !conversationId) return;
    const lastUserMessageIndex = messages.findLastIndex(m => m.role === 'user');
    if (lastUserMessageIndex === -1) return toast.info("No hay nada que regenerar.");
    const historyForRegen = messages.slice(0, lastUserMessageIndex + 1);
    setMessages(historyForRegen);
    await getAndStreamAIResponse(conversationId, historyForRegen);
  }, [isLoading, messages, conversationId, getAndStreamAIResponse]);

  const reapplyFilesFromMessage = async (message: Message) => {
    if (!appId) return toast.error("No hay un proyecto seleccionado para aplicar los archivos.");
    const filesToWrite = Array.isArray(message.content) ? message.content.filter((p): p is CodePart => p.type === 'code' && !!p.filename && !!p.code).map(p => ({ path: p.filename!, content: p.code! })) : [];
    if (filesToWrite.length > 0) await onWriteFiles(filesToWrite);
    else toast.info("No se encontraron archivos para aplicar en este mensaje.");
  };

  const clearChat = useCallback(async () => {
    if (!conversationId || !userId) return toast.error('No hay una conversación seleccionada o usuario autenticado.');
    setIsLoading(true);
    try {
      await chatDbService.clearMessages(conversationId, userId);
      setMessages([]);
      toast.success('Chat limpiado correctamente.');
    } catch (error: any) {
      toast.error(`Error al limpiar el chat: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, userId]);

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
    autoFixStatus,
  };
}