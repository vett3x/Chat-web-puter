"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useSession } from '@/components/session-context-provider';
import { ApiKey } from '@/hooks/use-user-api-keys';
import { ChatMode } from '@/components/chat/chat-input';
import { fetchAiResponse } from '@/lib/ai/chat-service';
import { buildSystemPrompt } from '@/lib/ai/prompt-builder';
import { parseAiResponseToRenderableParts, type RenderablePart } from '@/lib/ai/response-parser';
import {
  fetchConversationDetails,
  fetchMessages,
  createConversationInDB,
  updateConversationModelInDB,
  saveMessageToDB,
  clearChatInDB,
} from '@/lib/supabase/chat-db';
import { Message, AutoFixStatus, MessageContentPart } from '@/types/chat';

// The format Puter.js API expects for content arrays
type PuterContentPart = Extract<MessageContentPart, { type: 'text' | 'image_url' }>;

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
  const { userRole } = useSession();
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
    if (typeof window !== 'undefined') localStorage.setItem('selected_ai_model', selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    const loadConversationData = async () => {
      if (conversationId && userId) {
        setIsLoading(true);
        try {
          const details = await fetchConversationDetails(conversationId, userId);
          setSelectedModel(details?.model || localStorage.getItem('selected_ai_model') || DEFAULT_AI_MODEL_FALLBACK);
          const fetchedMsgs = await fetchMessages(conversationId, userId);
          if (!isSendingFirstMessage || fetchedMsgs.length > 0) setMessages(fetchedMsgs);
        } catch (error: any) {
          toast.error(error.message);
        } finally {
          setIsLoading(false);
        }
      } else {
        setMessages([]);
        setSelectedModel(localStorage.getItem('selected_ai_model') || DEFAULT_AI_MODEL_FALLBACK);
      }
    };
    loadConversationData();
  }, [conversationId, userId, isSendingFirstMessage]);

  const handleModelChange = async (modelValue: string) => {
    setSelectedModel(modelValue);
    if (conversationId && userId) {
      try {
        await updateConversationModelInDB(conversationId, userId, modelValue);
      } catch (error: any) {
        toast.error(error.message);
      }
    }
  };

  const getAndStreamAIResponse = useCallback(async (convId: string, history: Message[]) => {
    setIsLoading(true);
    const tempTypingId = `assistant-typing-${Date.now()}`;
    setMessages(prev => [...prev, { id: tempTypingId, role: 'assistant', content: '', isTyping: true, timestamp: new Date() }]);
    
    const userMessageToSave = history.findLast(m => m.role === 'user');

    try {
      const systemPrompt = buildSystemPrompt({ appPrompt, chatMode });
      const { content: assistantMessageContent, modelUsed: modelUsedForResponse } = await fetchAiResponse(history, systemPrompt, selectedModel, userApiKeys);

      if (userMessageToSave) {
        await saveMessageToDB(convId, userId!, userMessageToSave);
      }

      const isConstructionPlan = chatMode === 'build' && assistantMessageContent.includes('### 1. Análisis del Requerimiento');
      const parts = parseAiResponseToRenderableParts(assistantMessageContent);
      const filesToWrite: { path: string; content: string }[] = [];

      if (chatMode === 'build' && !isConstructionPlan) {
        parts.forEach((part: RenderablePart) => {
          if (part.type === 'code' && appId && (part as any).filename && (part as any).code) {
            filesToWrite.push({ path: (part as any).filename, content: (part as any).code });
          }
        });
      }

      setMessages(prev => prev.filter(m => m.id !== tempTypingId));

      const assistantMessageData = {
        content: isConstructionPlan ? assistantMessageContent : parts,
        role: 'assistant' as const,
        model: modelUsedForResponse,
        type: 'multimodal' as const,
        isConstructionPlan,
      };
      const tempId = `assistant-${Date.now()}`;
      setMessages(prev => [...prev, { ...assistantMessageData, id: tempId, timestamp: new Date(), isNew: true }]);
      
      const savedData = await saveMessageToDB(convId, userId!, assistantMessageData);
      if (savedData) {
        setMessages(prev => prev.map(msg => msg.id === tempId ? { ...msg, id: savedData.id, timestamp: savedData.timestamp } : msg));
      }

      if (filesToWrite.length > 0) {
        await onWriteFiles(filesToWrite);
      }

    } catch (error: any) {
      const isAdmin = userRole === 'admin' || userRole === 'super_admin';
      const errorMessageForDisplay = isAdmin ? `Error: ${error.message}` : 'Error con la IA, se ha enviado un ticket automático.';
      if (!isAdmin) {
        fetch('/api/error-tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error_message: error, conversation_id: convId }),
        }).catch(apiError => console.error("Failed to submit error ticket:", apiError));
      }
      toast.error(errorMessageForDisplay);
      setMessages(prev => prev.filter(m => m.id !== tempTypingId && m.id !== userMessageToSave?.id));
    } finally {
      setIsLoading(false);
    }
  }, [appId, appPrompt, chatMode, selectedModel, userApiKeys, onWriteFiles, userId, userRole]);

  const sendMessage = useCallback(async (content: PuterContentPart[], messageText: string) => {
    if (!userId) return;
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      setIsSendingFirstMessage(true);
      try {
        const newConv = await createConversationInDB(userId, selectedModel);
        if (!newConv) {
          setIsSendingFirstMessage(false);
          return;
        }
        currentConversationId = newConv.id;
        onNewConversationCreated(newConv.id);
        onConversationTitleUpdate(newConv.id, newConv.title);
        onSidebarDataRefresh();
      } catch (error: any) {
        toast.error(error.message);
        setIsSendingFirstMessage(false);
        return;
      }
    }

    const newUserMessage: Message = {
      id: `user-${Date.now()}`,
      conversation_id: currentConversationId || undefined,
      content,
      role: 'user',
      timestamp: new Date(),
      type: content.some(part => part.type === 'image_url') ? 'multimodal' : 'text',
    };
    setMessages(prev => [...prev, newUserMessage]);
    
    if (currentConversationId) {
      await getAndStreamAIResponse(currentConversationId, [...messages, newUserMessage]);
    }
    
    setIsSendingFirstMessage(false);
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
    };
    await getAndStreamAIResponse(conversationId, [...messages, approvalMessage]);
  }, [messages, conversationId, getAndStreamAIResponse]);

  const regenerateLastResponse = useCallback(async () => {
    if (isLoading || !conversationId) return;
    const lastUserMessageIndex = messages.findLastIndex(m => m.role === 'user');
    if (lastUserMessageIndex === -1) return;
    const historyForRegen = messages.slice(0, lastUserMessageIndex + 1);
    setMessages(historyForRegen);
    await getAndStreamAIResponse(conversationId, historyForRegen);
  }, [isLoading, messages, conversationId, getAndStreamAIResponse]);

  const reapplyFilesFromMessage = async (message: Message) => {
    if (!appId) return;
    const filesToWrite: { path: string; content: string }[] = [];
    if (Array.isArray(message.content)) {
      message.content.forEach(part => {
        if (part.type === 'code' && (part as any).filename && (part as any).code) {
          filesToWrite.push({ path: (part as any).filename, content: (part as any).code });
        }
      });
    }
    if (filesToWrite.length > 0) await onWriteFiles(filesToWrite);
    else toast.info("No se encontraron archivos para aplicar en este mensaje.");
  };

  const clearChat = useCallback(async () => {
    if (!conversationId || !userId) return;
    setIsLoading(true);
    try {
      await clearChatInDB(conversationId, userId);
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