"use client";

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSession } from '@/components/session-context-provider';
import { AI_PROVIDERS } from '@/lib/ai-models';
import { ApiKey } from '@/hooks/use-user-api-keys'; // NEW: Import ApiKey type
import { GoogleGenerativeAI, Part } from '@google/generative-ai'; // Import GoogleGenerativeAI and Part
import { GoogleAuth } from 'google-auth-library'; // Import GoogleAuth

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
        chat: (messages: PuterMessage[], options: { model: string }) => Promise<any>;
      };
    };
  }
}

type RenderablePart = TextPart | CodePart;

interface Message {
  id: string;
  conversation_id?: string;
  content: string | MessageContentPart[];
  role: 'user' | 'assistant';
  model?: string;
  timestamp: Date;
  isNew?: boolean;
  isTyping?: boolean;
  type?: 'text' | 'multimodal';
}

const DEFAULT_AI_MODEL_FALLBACK = 'puter:claude-sonnet-4'; // Fallback if Gemini 2.5 Flash not found or configured

interface UseChatProps {
  userId: string | undefined;
  conversationId: string | null;
  onNewConversationCreated: (conversationId: string) => void;
  onConversationTitleUpdate: (conversationId: string, newTitle: string) => void;
  appPrompt?: string | null;
  appId?: string | null;
  onWriteFiles: (files: { path: string; content: string }[]) => Promise<void>;
  onSidebarDataRefresh: () => void;
  userApiKeys: ApiKey[]; // NEW: Prop for user API keys
  isLoadingApiKeys: boolean; // NEW: Prop for loading state of API keys
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

  return parts.length > 0 ? parts : [{ type: 'text', text: content }];
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

// NEW: Helper to convert internal content parts to Gemini API parts
const convertToGeminiParts = (content: Message['content']): Part[] => {
  const parts: Part[] = [];
  if (typeof content === 'string') {
    parts.push({ text: content });
  } else if (Array.isArray(content)) {
    for (const part of content) {
      if (part.type === 'text') {
        parts.push({ text: part.text });
      } else if (part.type === 'image_url') {
        const url = part.image_url.url;
        const match = url.match(/^data:(image\/\w+);base64,(.*)$/);
        if (!match) {
          console.warn("Skipping invalid image data URL format for Gemini:", url.substring(0, 50) + '...');
          parts.push({ text: "[Unsupported Image]" });
        } else {
          const mimeType = match[1];
          const data = match[2];
          parts.push({ inlineData: { mimeType, data } });
        }
      } else if (part.type === 'code') {
        // Convert code blocks to text for Gemini API
        const codePart = part as CodePart;
        const lang = codePart.language || '';
        const filename = codePart.filename ? `:${codePart.filename}` : '';
        parts.push({ text: `\`\`\`${lang}${filename}\n${codePart.code || ''}\n\`\`\`` });
      }
    }
  }
  return parts;
};

export function useChat({
  userId,
  conversationId,
  onNewConversationCreated,
  onConversationTitleUpdate,
  appPrompt,
  appId,
  onWriteFiles,
  onSidebarDataRefresh,
  userApiKeys, // NEW: Destructure
  isLoadingApiKeys, // NEW: Destructure
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

  // NEW: Effect to determine default model based on userApiKeys
  useEffect(() => {
    if (!isLoadingApiKeys && userApiKeys.length > 0) {
      const storedModel = localStorage.getItem('selected_ai_model');
      let newDefaultModel = DEFAULT_AI_MODEL_FALLBACK;

      // Check if the stored model is a user_key and if it's still valid
      if (storedModel && storedModel.startsWith('user_key:')) {
        const storedKeyId = storedModel.substring(9);
        const isValidStoredKey = userApiKeys.some(key => key.id === storedKeyId);
        if (isValidStoredKey) {
          newDefaultModel = storedModel; // Keep the valid stored user_key model
        }
      } else if (storedModel && storedModel.startsWith('puter:')) {
        newDefaultModel = storedModel; // Keep the valid puter model
      }

      // If the current default is not Gemini 2.5 Flash, or if it's invalid, try to find Gemini 2.5 Flash
      const isCurrentDefaultGeminiFlash = newDefaultModel.includes('gemini-2.5-flash');
      
      if (!isCurrentDefaultGeminiFlash || !userApiKeys.some(key => `user_key:${key.id}` === newDefaultModel)) {
        const geminiFlashKey = userApiKeys.find(key => 
          key.provider === 'google_gemini' && 
          (key.model_name === 'gemini-2.5-flash' || key.model_name === 'gemini-2.5-pro') // Prioritize 2.5 Flash, then 2.5 Pro
        );

        if (geminiFlashKey) {
          newDefaultModel = `user_key:${geminiFlashKey.id}`;
        }
      }
      
      if (newDefaultModel !== selectedModel) {
        setSelectedModel(newDefaultModel);
        if (typeof window !== 'undefined') {
          localStorage.setItem('selected_ai_model', newDefaultModel);
        }
      }
    } else if (!isLoadingApiKeys && userApiKeys.length === 0 && selectedModel !== DEFAULT_AI_MODEL_FALLBACK) {
      // If no API keys are configured, fall back to Puter.js default
      setSelectedModel(DEFAULT_AI_MODEL_FALLBACK);
      if (typeof window !== 'undefined') {
        localStorage.setItem('selected_ai_model', DEFAULT_AI_MODEL_FALLBACK);
      }
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
        const details = await getConversationDetails(conversationId);
        if (details?.model) setSelectedModel(details.model);
        else setSelectedModel(localStorage.getItem('selected_ai_model') || DEFAULT_AI_MODEL_FALLBACK); // NEW: Use fallback
        const fetchedMsgs = await getMessagesFromDB(conversationId);
        if (!isSendingFirstMessage || fetchedMsgs.length > 0) setMessages(fetchedMsgs);
        setIsLoading(false);
      } else {
        setMessages([]);
        setSelectedModel(localStorage.getItem('selected_ai_model') || DEFAULT_AI_MODEL_FALLBACK); // NEW: Use fallback
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
    const { data, error } = await supabase.from('messages').insert({ conversation_id: convId, user_id: userId, role: msg.role, content: msg.content as any, model: msg.model, type: msg.type }).select('id, created_at').single();
    if (error) {
      toast.error('Error al guardar el mensaje.');
      return null;
    }
    return { id: data.id, timestamp: new Date(data.created_at) };
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
    };

    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    await getAndStreamAIResponse(currentConversationId, [...messages, newUserMessage]);
    setIsSendingFirstMessage(false); // Reset after first message is sent
  }, [userId, conversationId, messages, createNewConversationInDB, getAndStreamAIResponse]);


  const getAndStreamAIResponse = async (convId: string, history: Message[]) => {
    setIsLoading(true);
    const tempTypingId = `assistant-typing-${Date.now()}`;
    setMessages(prev => [...prev, { id: tempTypingId, role: 'assistant', content: '', isTyping: true, timestamp: new Date() }]);
    
    const userMessageToSave = history.findLast(m => m.role === 'user');

    try {
      let response: any;
      let modelUsedForResponse: string;
      let systemPromptContent: string;

      if (appPrompt) {
        systemPromptContent = `Eres un desarrollador experto en Next.js (App Router), TypeScript y Tailwind CSS. Tu tarea es generar los archivos necesarios para construir la aplicación que el usuario ha descrito: "${appPrompt}". REGLAS ESTRICTAS: 1. Responde ÚNICAMENTE con bloques de código. 2. Cada bloque de código DEBE representar un archivo completo. 3. Usa el formato \`\`\`language:ruta/del/archivo.tsx\`\`\` para cada bloque. 4. NO incluyas ningún texto conversacional, explicaciones, saludos o introducciones. Solo el código.`;
      } else {
        systemPromptContent = "Cuando generes un bloque de código, siempre debes especificar el lenguaje y un nombre de archivo descriptivo. Usa el formato ```language:filename.ext. Por ejemplo: ```python:chess_game.py. Esto es muy importante.";
      }

      const systemMessage: PuterMessage = { role: 'system', content: systemPromptContent };
      const messagesForApi = history.map(msg => ({
        role: msg.role,
        content: messageContentToApiFormat(msg.content),
      }));

      if (selectedModel.startsWith('puter:')) {
        const actualModelForPuter = selectedModel.substring(6);
        modelUsedForResponse = selectedModel;
        response = await window.puter.ai.chat([systemMessage, ...messagesForApi], { model: actualModelForPuter });

      } else if (selectedModel.startsWith('user_key:')) {
        const selectedKeyId = selectedModel.substring(9);
        modelUsedForResponse = selectedModel;

        const keyDetails = userApiKeys.find(key => key.id === selectedKeyId);
        if (!keyDetails) {
          throw new Error('No se encontró una API key activa con el ID proporcionado para este usuario. Por favor, verifica la Gestión de API Keys.');
        }

        if (keyDetails.provider === 'google_gemini') {
          const geminiMessages = history.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: convertToGeminiParts(msg.content),
          }));

          if (keyDetails.use_vertex_ai) {
            const project = keyDetails.project_id;
            const location = keyDetails.location_id;
            const jsonKeyContent = keyDetails.json_key_content;
            const finalModel = keyDetails.model_name;

            if (!project || !location || !jsonKeyContent || !finalModel) {
              throw new Error('Configuración incompleta para Google Vertex AI. Revisa la Gestión de API Keys.');
            }

            const credentials = JSON.parse(jsonKeyContent);
            const auth = new GoogleAuth({
              credentials,
              scopes: ['https://www.googleapis.com/auth/cloud-platform'],
            });
            const client = await auth.getClient();
            const accessToken = (await client.getAccessToken()).token;

            if (!accessToken) {
              throw new Error('No se pudo obtener el token de acceso para Vertex AI.');
            }

            const vertexAiUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${finalModel}:generateContent`;

            const vertexAiResponse = await fetch(vertexAiUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ contents: geminiMessages }),
            });

            if (!vertexAiResponse.ok) {
              const errorText = await vertexAiResponse.text();
              throw new Error(`Vertex AI API returned an error: ${vertexAiResponse.status} - ${errorText.substring(0, 200)}...`);
            }

            const vertexAiResult = await vertexAiResponse.json();
            if (vertexAiResult.error) {
              throw new Error(vertexAiResult.error?.message || `Error en la API de Vertex AI: ${JSON.stringify(vertexAiResult)}`);
            }
            response = { message: { content: vertexAiResult.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo obtener una respuesta de texto de Vertex AI.' } };

          } else { // Public Gemini API
            const apiKey = keyDetails.api_key;
            const finalModel = keyDetails.model_name;
            if (!apiKey || !finalModel) {
              throw new Error('API Key o modelo no configurado para Google Gemini. Revisa la Gestión de API Keys.');
            }
            const genAI = new GoogleGenerativeAI(apiKey);
            const result = await genAI.getGenerativeModel(finalModel).generateContent({ contents: geminiMessages }); // FIXED: genAI.models.generateContent to genAI.getGenerativeModel(finalModel).generateContent
            response = { message: { content: result.text } };
          }
        } else if (keyDetails.provider === 'custom_endpoint') {
          const customApiKey = keyDetails.api_key;
          const customEndpointUrl = keyDetails.api_endpoint;
          const customModelId = keyDetails.model_name;

          if (!customEndpointUrl || !customApiKey || !customModelId) {
            throw new Error('Configuración incompleta para el endpoint personalizado. Revisa la Gestión de API Keys.');
          }

          const customApiMessages = history.map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user', // Custom endpoints often expect 'assistant' for model responses
            content: messageContentToApiFormat(msg.content),
          }));

          const customEndpointResponse = await fetch(customEndpointUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${customApiKey}`,
            },
            body: JSON.stringify({
              model: customModelId,
              messages: customApiMessages,
            }),
          });

          if (!customEndpointResponse.ok) {
            const errorText = await customEndpointResponse.text();
            throw new Error(`Custom Endpoint API returned an error: ${customEndpointResponse.status} - ${errorText.substring(0, 200)}...`);
          }

          const customEndpointResult = await customEndpointResponse.json();
          response = { message: { content: customEndpointResult.choices?.[0]?.message?.content || 'No se pudo obtener una respuesta del endpoint personalizado.' } };

        } else {
          throw new Error('Proveedor de IA no válido seleccionado.');
        }
      } else {
        throw new Error('Modelo de IA no válido seleccionado.');
      }

      if (!response || response.error) throw new Error(response?.error?.message || JSON.stringify(response?.error) || 'Error de la IA.');

      if (userMessageToSave) {
        await saveMessageToDB(convId, userMessageToSave);
      }

      const assistantMessageContent = response?.message?.content || 'Sin contenido.';
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
        model: modelUsedForResponse,
        type: 'multimodal' as const,
      };
      const tempId = `assistant-${Date.now()}`;
      setMessages(prev => [...prev, { ...assistantMessageData, id: tempId, timestamp: new Date(), isNew: true }]);
      
      const savedData = await saveMessageToDB(convId, assistantMessageData);
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
          body: JSON.stringify({ error_message: rawError, conversation_id: convId }),
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