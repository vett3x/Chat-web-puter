"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSession } from '@/components/session-context-provider';
import { AI_PROVIDERS } from '@/lib/ai-models';
import { ApiKey } from '@/hooks/use-user-api-keys';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { GoogleAuth } from 'google-auth-library';
import { ChatMode } from '@/components/chat/chat-input';
import { parseAiResponseToRenderableParts, RenderablePart } from '@/lib/utils'; // Importar desde utils

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
  content: string | RenderablePart[]; // MODIFICADO: Ahora content puede ser string o RenderablePart[]
  role: 'user' | 'assistant';
  model?: string;
  timestamp: Date;
  isNew: boolean; // Changed from optional to required boolean
  isTyping: boolean; // Changed from optional to required boolean
  type?: 'text' | 'multimodal';
  isConstructionPlan: boolean; // Changed from optional to required boolean
  planApproved: boolean; // Changed from optional to required boolean
  isCorrectionPlan: boolean; // Changed from optional to required boolean
  correctionApproved: boolean; // Changed from optional to required boolean
  isAnimated: boolean; // NEW: Flag to track if message has been animated
}

export type AutoFixStatus = 'idle' | 'analyzing' | 'plan_ready' | 'fixing' | 'failed';

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
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selected_ai_model') || DEFAULT_AI_MODEL_FALLBACK;
    }
    return DEFAULT_AI_MODEL_FALLBACK;
  });
  const [autoFixStatus, setAutoFixStatus] = useState<AutoFixStatus>('idle');
  const autoFixAttempts = useRef(0);

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

    const storedModel = localStorage.getItem('selected_ai_model');
    let currentModelIsValid = false;

    if (storedModel) {
      if (storedModel.startsWith('user_key:')) {
        const keyId = storedModel.substring(9);
        if (userApiKeys.some(key => key.id === keyId)) {
          currentModelIsValid = true;
        }
      } else if (storedModel.startsWith('puter:')) {
        currentModelIsValid = true;
      }
    }

    if (!currentModelIsValid) {
      let newDefaultModel = DEFAULT_AI_MODEL_FALLBACK;
      const geminiFlashKey = userApiKeys.find(key => 
        key.provider === 'google_gemini' && 
        (key.model_name === 'gemini-2.5-flash' || key.model_name === 'gemini-2.5-pro')
      );

      if (geminiFlashKey) {
        newDefaultModel = `user_key:${geminiFlashKey.id}`;
      }
      
      setSelectedModel(newDefaultModel);
      if (typeof window !== 'undefined') {
        localStorage.setItem('selected_ai_model', newDefaultModel);
      }
    } else {
      setSelectedModel(storedModel || DEFAULT_AI_MODEL_FALLBACK);
    }
  }, [isLoadingApiKeys, userApiKeys]);


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
    const { data, error } = await supabase.from('messages').select('id, content, role, model, created_at, conversation_id, type, plan_approved').eq('conversation_id', convId).eq('user_id', userId).order('created_at', { ascending: true });
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
      isConstructionPlan: typeof msg.content === 'string' && msg.content.includes('### 1. Análisis del Requerimiento'), // Detect plan from DB
      planApproved: msg.plan_approved || false, // NEW: Fetch plan_approved from DB
      isCorrectionPlan: false, // Default to false when loading from DB
      correctionApproved: false, // Default to false when loading from DB
      isNew: false, // Messages from DB are not 'new'
      isTyping: false, // Messages from DB are not 'typing'
      isAnimated: true, // Messages from DB are considered animated
    }));
  }, [userId]);

  useEffect(() => {
    const loadConversationData = async () => {
      if (conversationId && userId) {
        setIsLoading(true);
        const details = await getConversationDetails(conversationId);
        if (details?.model) {
          setSelectedModel(details.model);
        }
        const fetchedMsgs = await getMessagesFromDB(conversationId);
        if (!isSendingFirstMessage || fetchedMsgs.length > 0) setMessages(fetchedMsgs);
        setIsLoading(false);
      } else {
        setMessages([]);
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
    onSidebarDataRefresh();
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
    const { data, error } = await supabase.from('messages').insert({ 
      conversation_id: convId, 
      user_id: userId, 
      role: msg.role, 
      content: msg.content as any, 
      model: msg.model, 
      type: msg.type,
      plan_approved: msg.planApproved, // NEW: Save planApproved status
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
    
    // Add a placeholder message immediately
    setMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: '', isTyping: true, isNew: true, isConstructionPlan: false, planApproved: false, isCorrectionPlan: false, correctionApproved: false, isAnimated: false, timestamp: new Date() }]);
    
    const userMessageToSave = history.findLast(m => m.role === 'user');
    if (userMessageToSave) {
      await saveMessageToDB(convId, userMessageToSave);
    }

    try {
      let systemPromptContent: string;
      const isAppChatModeBuild = !!appPrompt && chatMode === 'build';

      if (isAppChatModeBuild) {
        systemPromptContent = `Eres un desarrollador experto en Next.js (App Router), TypeScript y Tailwind CSS. Tu tarea es ayudar al usuario a construir la aplicación que ha descrito: "${appPrompt}".
        REGLAS DEL MODO BUILD:
        1.  **PLANIFICAR PRIMERO:** Antes de escribir cualquier código, responde con un "Plan de Construcción" detallado usando este formato Markdown exacto:
            ### 1. Análisis del Requerimiento
            [Tu análisis aquí]
            ### 2. Estructura de Archivos y Componentes
            [Lista de archivos a crear/modificar aquí]
            ### 3. Lógica de Componentes
            [Breve descripción de la lógica de cada componente aquí]
            ### 4. Dependencias Necesarias
            [Lista de dependencias npm aquí, si las hay]
            ### 5. Resumen y Confirmación
            [Resumen y pregunta de confirmación aquí]
        2.  **ESPERAR APROBACIÓN:** Después de enviar el plan, detente y espera. NO generes código. El usuario te responderá con un mensaje especial: "[USER_APPROVED_PLAN]".
        3.  **GENERAR CÓDIGO:** SOLO cuando recibas el mensaje "[USER_APPROVED_PLAN]", responde ÚNICAMENTE con los bloques de código para los archivos completos. Usa el formato \`\`\`language:ruta/del/archivo.tsx\`\`\` para cada bloque. NO incluyas texto conversacional en esta respuesta final de código.`;
      } else if (appPrompt) {
        systemPromptContent = `Eres un asistente de código experto y depurador para un proyecto Next.js. Estás en 'Modo Chat'. Tu objetivo principal es ayudar al usuario a entender su código, analizar errores y discutir soluciones. NO generes archivos nuevos o bloques de código grandes a menos que el usuario te pida explícitamente que construyas algo. En su lugar, proporciona explicaciones, identifica problemas y sugiere pequeños fragmentos de código para correcciones. Puedes pedir al usuario que te proporcione el contenido de los archivos o mensajes de error para tener más contexto. El proyecto es: "${appPrompt}".`;
      } else {
        systemPromptContent = "Cuando generes un bloque de código, siempre debes especificar el lenguaje y un nombre de archivo descriptivo. Usa el formato ```language:filename.ext. Por ejemplo: ```python:chess_game.py. Esto es muy importante.";
      }

      const systemMessage: PuterMessage = { role: 'system', content: systemPromptContent };
      const messagesForApi = history.map(msg => ({
        role: msg.role,
        content: messageContentToApiFormat(msg.content),
      }));

      let fullResponseText = '';
      let modelUsedForResponse = selectedModel;

      const selectedKey = userApiKeys.find(k => `user_key:${k.id}` === selectedModel);
      const isCustomEndpoint = selectedKey?.provider === 'custom_endpoint';

      if (selectedModel.startsWith('puter:') || isCustomEndpoint) {
        let response;
        if (isCustomEndpoint) {
          const apiResponse = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [systemMessage, ...messagesForApi],
              selectedKeyId: selectedModel.substring(9),
              stream: false, // Request non-streaming for custom endpoint
            }),
          });
          response = await apiResponse.json();
          if (!apiResponse.ok) throw new Error(response.message || 'Error en la API de IA.');
        } else {
          const actualModelForPuter = selectedModel.substring(6);
          response = await window.puter.ai.chat([systemMessage, ...messagesForApi], { model: actualModelForPuter });
        }
        if (!response || response.error) throw new Error(response?.error?.message || JSON.stringify(response?.error) || 'Error de la IA.');
        fullResponseText = response?.message?.content || 'Sin contenido.';
      } else if (selectedModel.startsWith('user_key:')) {
        const apiResponse = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [systemMessage, ...messagesForApi],
            selectedKeyId: selectedModel.substring(9),
            stream: true, // Request streaming for Gemini
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

          // Only update messages during streaming if NOT a construction plan
          if (!isAppChatModeBuild || !fullResponseText.includes('### 1. Análisis del Requerimiento')) {
            setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: parseAiResponseToRenderableParts(fullResponseText, isAppChatModeBuild), isTyping: false, isNew: true } : m));
          }
        }
      } else {
        throw new Error('Modelo de IA no válido seleccionado.');
      }

      const isConstructionPlan = isAppChatModeBuild && fullResponseText.includes('### 1. Análisis del Requerimiento');
      const finalContentForMessage = isConstructionPlan ? fullResponseText : parseAiResponseToRenderableParts(fullResponseText, isAppChatModeBuild);
      const filesToWrite: { path: string; content: string }[] = [];

      if (isAppChatModeBuild && !isConstructionPlan) { // Only extract files if NOT a construction plan
        (finalContentForMessage as RenderablePart[]).forEach(part => {
          if (part.type === 'code' && appId && part.filename && part.code) {
            filesToWrite.push({ path: part.filename, content: part.code });
          }
        });
      }

      const finalAssistantMessageData: Omit<Message, 'timestamp' | 'id'> = {
        content: finalContentForMessage,
        role: 'assistant' as const,
        model: modelUsedForResponse,
        type: 'multimodal' as const,
        isConstructionPlan: isConstructionPlan,
        planApproved: false, // Default to false for new messages
        isCorrectionPlan: false,
        correctionApproved: false,
        isNew: true, // Mark as new for animation
        isTyping: false,
        isAnimated: false, // Mark as not animated yet for new messages
      };

      const savedData = await saveMessageToDB(convId, finalAssistantMessageData);
      setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, ...finalAssistantMessageData, id: savedData?.id || assistantMessageId, timestamp: savedData?.timestamp || new Date() } : m));

      if (filesToWrite.length > 0) {
        await onWriteFiles(filesToWrite);
      }

    } catch (error: any) {
      console.error('[API /ai/chat] Error:', error);
      let userFriendlyMessage = `Error en la API de IA: ${error.message}`;
      setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: userFriendlyMessage, isTyping: false, isNew: true, isConstructionPlan: false, planApproved: false, isCorrectionPlan: false, correctionApproved: false, isAnimated: false } : m));
      toast.error(userFriendlyMessage);
    } finally {
      setIsLoading(false);
    }
  }, [appId, appPrompt, userRole, onWriteFiles, selectedModel, userId, saveMessageToDB, chatMode, userApiKeys]);

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
      isAnimated: true, // User messages are always 'animated'
    };

    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    await getAndStreamAIResponse(currentConversationId, [...messages, newUserMessage]);
    setIsSendingFirstMessage(false);
  }, [userId, conversationId, messages, createNewConversationInDB, getAndStreamAIResponse]);

  const approvePlan = useCallback(async (messageId: string) => {
    const planMessage = messages.find(m => m.id === messageId);
    if (!planMessage || !conversationId) return;

    // Update local state
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, planApproved: true } : m));

    // Update in DB
    const { error } = await supabase
      .from('messages')
      .update({ plan_approved: true })
      .eq('id', messageId)
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating plan_approved status in DB:', error);
      toast.error('Error al guardar la aprobación del plan.');
      // Optionally revert local state if DB update fails
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, planApproved: false } : m));
      return;
    }
    toast.success('Plan aprobado y guardado.');

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

    const historyWithApproval = [...messages, approvalMessage];
    
    await getAndStreamAIResponse(conversationId, historyWithApproval);

  }, [messages, conversationId, getAndStreamAIResponse, userId]);


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
  }, [isLoading, messages, getAndStreamAIResponse]);

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

  const clearChat = useCallback(async () => {
    if (!conversationId || !userId) {
      toast.error('No hay una conversación seleccionada o usuario autenticado.');
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(error.message);
      }
      setMessages([]);
      toast.success('Chat limpiado correctamente.');
    } catch (error: any) {
      console.error('Error clearing chat:', error);
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