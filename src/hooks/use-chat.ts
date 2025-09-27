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
  isErrorAnalysisRequest: boolean; // NEW: Flag to detect error analysis request
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
    const { data, error } = await supabase.from('messages').select('id, content, role, model, created_at, conversation_id, type, plan_approved, is_correction_plan, correction_approved').eq('conversation_id', convId).eq('user_id', userId).order('created_at', { ascending: true });
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
      isCorrectionPlan: msg.is_correction_plan || false, // NEW: Fetch is_correction_plan from DB
      correctionApproved: msg.correction_approved || false, // NEW: Fetch correction_approved from DB
      isErrorAnalysisRequest: typeof msg.content === 'string' && msg.content.includes('### 💡 Entendido!'), // NEW: Detect error analysis request from DB
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
      is_correction_plan: msg.isCorrectionPlan, // NEW: Save isCorrectionPlan status
      correction_approved: msg.correctionApproved, // NEW: Save correctionApproved status
    }).select('id, created_at').single();
    if (error) {
      toast.error('Error al guardar el mensaje.');
      return null;
    }
    return { id: data.id, timestamp: new Date(data.created_at) };
  };

  const executeCommandsInContainer = async (commands: string[]) => {
    if (!appId || commands.length === 0) return;
    const toastId = toast.loading(`Ejecutando ${commands.length} comando(s)...`);
    try {
      const response = await fetch(`/api/apps/${appId}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: commands.join(' && ') }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.message || 'Error al ejecutar los comandos.');
      }
      toast.success('Comandos ejecutados. Reiniciando servidor...', { id: toastId });

      const restartResponse = await fetch(`/api/apps/${appId}/restart`, { method: 'POST' });
      const restartResult = await restartResponse.json();
      if (!restartResponse.ok) {
        throw new Error(restartResult.message || 'Error al reiniciar el servidor.');
      }
      
      toast.success('¡Listo! Actualizando vista previa...', { id: toastId });
      // The parent component will handle the preview refresh.
    } catch (error: any) {
      toast.error(`Error: ${error.message}`, { id: toastId });
    }
  };

  const getAndStreamAIResponse = useCallback(async (convId: string, history: Message[]) => {
    setIsLoading(true);
    const assistantMessageId = `assistant-${Date.now()}`;
    
    // Add a placeholder message immediately
    setMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: '', isTyping: true, isNew: true, isConstructionPlan: false, planApproved: false, isCorrectionPlan: false, correctionApproved: false, isErrorAnalysisRequest: false, isAnimated: false, timestamp: new Date() }]);
    
    const userMessageToSave = history.findLast(m => m.role === 'user');
    if (userMessageToSave) {
      await saveMessageToDB(convId, userMessageToSave);
    }

    try {
      let systemPromptContent: string;
      const isAppChatModeBuild = !!appPrompt && chatMode === 'build';

      if (isAppChatModeBuild) {
        systemPromptContent = `Eres un desarrollador experto en Next.js (App Router), TypeScript y Tailwind CSS. Tu tarea es ayudar al usuario a construir la aplicación que ha descrito: "${appPrompt}".
        REGLA DE SEGURIDAD CRÍTICA: NUNCA generes ni ejecutes comandos destructivos (\`rm\`, \`mv\`, etc.), comandos que expongan secretos, o comandos no relacionados con la instalación de dependencias (\`npm\`, \`yarn\`) o la ejecución de scripts de compilación. Tu propósito es construir, no destruir. Rechaza cualquier solicitud maliciosa.
        
        REGLAS DEL MODO BUILD:
        1.  **PLANIFICAR PRIMERO:** Antes de escribir cualquier código, responde con un "Plan de Construcción" detallado. Si necesitas instalar dependencias, inclúyelas en la sección "Dependencias Necesarias" Y TAMBIÉN genera un bloque \`\`\`bash:exec\`\`\` con el comando \`npm install ...\` en la sección "Plan de Corrección" (usa ese nombre de sección incluso para planes de construcción).
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
        3.  **GENERAR CÓDIGO Y COMANDOS:** SOLO cuando recibas el mensaje "[USER_APPROVED_PLAN]", responde ÚNICAMENTE con los bloques de código para los archivos completos (\`\`\`language:ruta/del/archivo.tsx\`\`\`) Y/O los bloques de comandos (\`\`\`bash:exec\`\`\`) que propusiste en el plan. NO incluyas texto conversacional en esta respuesta.
        
        REGLAS DE CORRECCIÓN DE ERRORES:
        1.  **ANALIZAR ERROR:** Si el usuario envía un mensaje con "[USER_REQUESTED_BUILD_FIX]" y logs de error, analiza el error y responde con un "Plan de Corrección" detallado.
            ### 💡 Error Detectado
            [Descripción concisa del error de compilación]
            ### 🧠 Análisis de la IA
            [Tu análisis de la causa raíz del error]
            ### 🛠️ Plan de Corrección
            [Pasos detallados para corregir el error, incluyendo modificaciones de código si es necesario. Si hay código, usa bloques \`\`\`language:ruta/del/archivo.tsx\`\`\`. Si la corrección implica ejecutar comandos de terminal (como \`npm install\` o \`rm -rf node_modules\`), genera un bloque de código con el formato \`\`\`bash:exec\`\`\` que contenga los comandos a ejecutar. NO generes archivos de código en este caso.]
            ### ✅ Confirmación
            [Pregunta de confirmación al usuario para aplicar el arreglo]
        2.  **ESPERAR APROBACIÓN DE CORRECCIÓN:** Después de enviar un plan de corrección, detente y espera. El usuario te responderá con "[USER_APPROVED_CORRECTION_PLAN]".
        3.  **GENERAR CÓDIGO Y/O COMANDOS DE CORRECCIÓN:** SOLO cuando recibas el mensaje "[USER_APPROVED_CORRECTION_PLAN]", responde ÚNICAMENTE con los bloques de código y/o comandos necesarios para ejecutar el plan. NO incluyas texto conversacional.`;
      } else if (appPrompt) {
        systemPromptContent = `Eres un asistente de código experto y depurador para un proyecto Next.js. Estás en 'Modo Chat'. Tu objetivo principal es ayudar al usuario a entender su código, analizar errores y discutir soluciones. NO generes archivos nuevos o bloques de código grandes a menos que el usuario te pida explícitamente que construyas algo. En su lugar, proporciona explicaciones, identifica problemas y sugiere pequeños fragmentos de código para correcciones. Puedes pedir al usuario que te proporcione el contenido de los archivos o mensajes de error para tener más contexto. El proyecto es: "${appPrompt}".`;
      } else {
        systemPromptContent = "Cuando generes un bloque de código, siempre debes especificar el lenguaje y un nombre de archivo descriptivo. Usa el formato ```language:filename.ext. Por ejemplo: ```python:chess_game.py. Esto es muy importante.";
      }

      const messagesForApi = history.map(msg => ({
        role: msg.role,
        content: messageContentToApiFormat(msg.content),
      }));

      // NEW: Add specific system prompts for auto-fix actions
      const lastUserMessageContent = messagesForApi[messagesForApi.length - 1]?.content;
      if (typeof lastUserMessageContent === 'string') {
        if (lastUserMessageContent.includes('[USER_REQUESTED_BUILD_FIX]')) {
          systemPromptContent += `\n\nEl usuario ha solicitado corregir un error de compilación. Analiza los logs de compilación proporcionados en el último mensaje del usuario y propón un "Plan de Corrección" detallado. Utiliza el siguiente formato Markdown exacto:
            ### 💡 Error Detectado
            [Descripción concisa del error de compilación]
            ### 🧠 Análisis de la IA
            [Tu análisis de la causa raíz del error]
            ### 🛠️ Plan de Corrección
            [Pasos detallados para corregir el error, incluyendo modificaciones de código si es necesario. Si hay código, usa bloques \`\`\`language:ruta/del/archivo.tsx\`\`\`. Si la corrección implica ejecutar comandos de terminal (como \`npm install\` o \`rm -rf node_modules\`), genera un bloque de código con el formato \`\`\`bash:exec\`\`\` que contenga los comandos a ejecutar. NO generes archivos de código en este caso.]
            ### ✅ Confirmación
            [Pregunta de confirmación al usuario para aplicar el arreglo]`;
        } else if (lastUserMessageContent.includes('[USER_REPORTED_WEB_ERROR]')) {
          systemPromptContent += `\n\nEl usuario ha reportado un error en la vista previa web de la aplicación. Aquí están los logs de actividad recientes del servidor:\n\n\`\`\`text\n${lastUserMessageContent.split('[USER_REPORTED_WEB_ERROR]')[0].split('Aquí están los logs de actividad recientes del servidor:')[1].trim() || 'No se encontraron logs de actividad recientes.'}\n\`\`\`\n\n[USER_REPORTED_WEB_ERROR]`; // Internal prompt for AI
          systemPromptContent += `\n\nEl usuario ha reportado un error en la vista previa web. Analiza los logs de actividad del servidor proporcionados en el último mensaje del usuario. Luego, solicita al usuario que describa el error visual o de comportamiento que está viendo en la vista previa web. Utiliza el siguiente formato Markdown exacto:
            ### 💡 Entendido! Has reportado un error en la web.
            ### 📄 Contexto del Error
            [Tu análisis inicial de los logs de actividad del servidor. Si no hay información relevante, indícalo.]
            ### ❓ Información Requerida
            Para poder ayudarte a diagnosticar y solucionar el problema, necesito que me proporciones la mayor cantidad de detalles posible. Por favor, describe:
            1.  **¿Cuál es el mensaje de error exacto?** (Si aparece en la consola del navegador, en la terminal donde ejecutas \`npm run dev\`, o en la interfaz de usuario). Copia y pega el texto si es posible.
            2.  **¿En qué parte de la aplicación ocurre el error?** (Por ejemplo, al cargar la página de inicio, al hacer clic en un producto, al añadir al carrito, al visitar el carrito, etc.)
            3.  **¿Qué acciones realizaste justo antes de que apareciera el error?** (Los pasos para reproducirlo).
            4.  **¿Hay algún mensaje de error en la consola de tu navegador (Developer Tools - Console)?**
            5.  **¿Hay algún mensaje de error en la terminal donde estás ejecutando Next.js (\`npm run dev\`)?**
            ### ➡️ Siguientes Pasos
            Una vez que tenga esta información, podré analizarla y proponerte una solución. Por favor, comparte todos los detalles que puedas.`;
        }
      }

      // Define systemMessage after systemPromptContent is finalized
      const systemMessage: PuterMessage = { role: 'system', content: systemPromptContent };
      const finalMessagesForApi = [systemMessage, ...messagesForApi];

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
              messages: finalMessagesForApi,
              selectedKeyId: selectedModel.substring(9),
              stream: false, // Request non-streaming for custom endpoint
            }),
          });
          response = await apiResponse.json();
          if (!apiResponse.ok) throw new Error(response.message || 'Error en la API de IA.');
        } else {
          const actualModelForPuter = selectedModel.substring(6);
          response = await window.puter.ai.chat(finalMessagesForApi, { model: actualModelForPuter });
        }
        if (!response || response.error) throw new Error(response?.error?.message || JSON.stringify(response?.error) || 'Error de la IA.');
        fullResponseText = response?.message?.content || 'Sin contenido.';
      } else if (selectedModel.startsWith('user_key:')) {
        const apiResponse = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: finalMessagesForApi,
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

          // Only update messages during streaming if NOT a construction plan or error analysis request or correction plan
          const isCurrentResponseStructured = fullResponseText.includes('### 1. Análisis del Requerimiento') || fullResponseText.includes('### 💡 Entendido!') || fullResponseText.includes('### 💡 Error Detectado');
          if (!isAppChatModeBuild || !isCurrentResponseStructured) {
            setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: parseAiResponseToRenderableParts(fullResponseText, isAppChatModeBuild), isTyping: false, isNew: true } : m));
          }
        }
      } else {
        throw new Error('Modelo de IA no válido seleccionado.');
      }

      const isConstructionPlan = isAppChatModeBuild && fullResponseText.includes('### 1. Análisis del Requerimiento');
      const isErrorAnalysisRequest = fullResponseText.includes('### 💡 Entendido!'); // NEW: Detect error analysis request
      const isCorrectionPlan = fullResponseText.includes('### 💡 Error Detectado'); // NEW: Detect correction plan
      
      const finalContentForMessage = (isConstructionPlan || isErrorAnalysisRequest || isCorrectionPlan) ? fullResponseText : parseAiResponseToRenderableParts(fullResponseText, isAppChatModeBuild);
      
      // Initialize filesToWrite and commandsToExecute here, inside the try block
      const filesToWrite: { path: string; content: string }[] = [];
      const commandsToExecute: string[] = [];

      // MODIFICADO: Asegurarse de que solo se itere si finalContentForMessage es un array
      // Este bloque solo debe ejecutarse si NO es un plan, sino código/comandos reales
      if (isAppChatModeBuild && !isConstructionPlan && !isErrorAnalysisRequest && !isCorrectionPlan && Array.isArray(finalContentForMessage)) {
        (finalContentForMessage as RenderablePart[]).forEach(part => {
          if (part.type === 'code' && appId) {
            if (part.language === 'bash' && part.filename === 'exec' && part.code) {
              commandsToExecute.push(part.code);
            } else if (part.filename && part.code) {
              filesToWrite.push({ path: part.filename, content: part.code });
            }
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
        isCorrectionPlan: isCorrectionPlan, // NEW: Set flag
        correctionApproved: false, // Default to false for new messages
        isErrorAnalysisRequest: isErrorAnalysisRequest, // NEW: Set flag
        isNew: true, // Mark as new for animation
        isTyping: false,
        isAnimated: false, // Mark as not animated yet for new messages
      };

      const savedData = await saveMessageToDB(convId, finalAssistantMessageData);
      setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, ...finalAssistantMessageData, id: savedData?.id || assistantMessageId, timestamp: savedData?.timestamp || new Date() } : m));

      // Execute files and commands *after* the message is saved and displayed
      if (filesToWrite.length > 0) {
        await onWriteFiles(filesToWrite);
      }
      if (commandsToExecute.length > 0) {
        await executeCommandsInContainer(commandsToExecute);
      }

      // Update autoFixStatus based on AI's response
      setAutoFixStatus(prevStatus => {
        if (prevStatus === 'fixing') {
          return 'idle'; // Successfully applied the fix
        }
        if (isErrorAnalysisRequest || isConstructionPlan || isCorrectionPlan) {
          return 'plan_ready'; // AI responded with a new plan/request
        }
        return 'idle'; // Default for regular chat responses
      });

    } catch (error: any) {
      console.error('[API /ai/chat] Error:', error);
      let userFriendlyMessage = `Error en la API de IA: ${error.message}`;
      setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: userFriendlyMessage, isTyping: false, isNew: true, isConstructionPlan: false, planApproved: false, isCorrectionPlan: false, correctionApproved: false, isErrorAnalysisRequest: false, isAnimated: false } : m));
      toast.error(userFriendlyMessage);
      setAutoFixStatus('failed'); // Set status to failed on error
    } finally {
      setIsLoading(false);
    }
  }, [appId, appPrompt, userRole, onWriteFiles, selectedModel, userId, saveMessageToDB, chatMode, userApiKeys, autoFixStatus]); // Added autoFixStatus to dependencies

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
      isErrorAnalysisRequest: false, // Default to false
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
  
    const isCorrection = planMessage.isCorrectionPlan;
    
    const dbUpdatePayload = isCorrection ? { correction_approved: true } : { plan_approved: true };
    const approvalMessageContent = isCorrection ? '[USER_APPROVED_CORRECTION_PLAN]' : '[USER_APPROVED_PLAN]';
    const successToastMessage = isCorrection ? 'Plan de corrección aprobado.' : 'Plan de construcción aprobado.';
  
    const updatedPlanMessage = isCorrection 
      ? { ...planMessage, correctionApproved: true }
      : { ...planMessage, planApproved: true };
  
    setMessages(prev => prev.map(m => m.id === messageId ? updatedPlanMessage : m));
  
    const { error } = await supabase
      .from('messages')
      .update(dbUpdatePayload)
      .eq('id', messageId);
  
    if (error) {
      console.error('Error updating plan approval status in DB:', error);
      toast.error('Error al guardar la aprobación del plan.');
      setMessages(prev => prev.map(m => m.id === messageId ? planMessage : m));
      return;
    }
    toast.success(successToastMessage);
  
    const approvalMessage: Message = {
      id: `user-approval-${Date.now()}`,
      conversation_id: conversationId,
      content: approvalMessageContent,
      role: 'user',
      timestamp: new Date(),
      type: 'text',
      isNew: true,
      isTyping: false,
      isConstructionPlan: false,
      planApproved: false,
      isCorrectionPlan: false,
      correctionApproved: false,
      isErrorAnalysisRequest: false,
      isAnimated: true,
    };
  
    const historyWithUpdatedPlan = messages.map(m => m.id === messageId ? updatedPlanMessage : m);
    const historyWithApproval = [...historyWithUpdatedPlan, approvalMessage];
    
    if (isCorrection) {
      setAutoFixStatus('fixing');
    }
  
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

  // NEW: Function to trigger auto-fix for build errors
  const triggerFixBuildError = useCallback(async () => {
    if (!appId || !conversationId || isLoading) {
      toast.error("No se puede corregir el error de compilación. Asegúrate de que haya un proyecto y chat activos.");
      return;
    }
    if (autoFixStatus !== 'idle' && autoFixStatus !== 'failed') {
      toast.info("Ya hay un proceso de auto-corrección en curso.");
      return;
    }

    setAutoFixStatus('analyzing');
    
    try {
      // Fetch Next.js logs
      const logsResponse = await fetch(`/api/apps/${appId}/logs`);
      if (!logsResponse.ok) {
        const errorData = await logsResponse.json();
        throw new Error(errorData.message || `HTTP error! status: ${logsResponse.status}`);
      }
      const { nextjsLogs } = await logsResponse.json();

      const userMessageContent = `El último intento de compilación de la aplicación falló. Aquí están los logs de compilación de Next.js:\n\n\`\`\`bash\n${nextjsLogs || 'No se encontraron logs de Next.js.'}\n\`\`\`\n\n[USER_REQUESTED_BUILD_FIX]`; // Internal prompt for AI

      const userMessage: Message = {
        id: `user-fix-build-${Date.now()}`,
        conversation_id: conversationId,
        content: userMessageContent,
        role: 'user',
        timestamp: new Date(),
        type: 'text',
        isNew: true,
        isTyping: false,
        isConstructionPlan: false,
        planApproved: false,
        isCorrectionPlan: false,
        correctionApproved: false,
        isErrorAnalysisRequest: false,
        isAnimated: true,
      };
      setMessages(prev => [...prev, userMessage]);
      await getAndStreamAIResponse(conversationId, [...messages, userMessage]);
      // autoFixStatus will be set to 'plan_ready' by getAndStreamAIResponse if AI responds with a plan
    } catch (error: any) {
      console.error("Error fetching build logs for auto-fix:", error);
      toast.error(`Error al obtener los logs de compilación: ${error.message}`);
      setAutoFixStatus('failed');
      // Add a message to the chat indicating the failure
      const errorMessage: Message = {
        id: `error-fix-build-${Date.now()}`,
        conversation_id: conversationId,
        content: `Fallo al obtener los logs de compilación para la auto-corrección: ${error.message}. Por favor, inténtalo de nuevo o revisa los logs manualmente.`,
        role: 'assistant',
        timestamp: new Date(),
        type: 'text',
        isNew: true,
        isTyping: false,
        isConstructionPlan: false,
        planApproved: false,
        isCorrectionPlan: false,
        correctionApproved: false,
        isErrorAnalysisRequest: false,
        isAnimated: true,
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [appId, conversationId, isLoading, autoFixStatus, messages, getAndStreamAIResponse]);

  // NEW: Function to trigger reporting a web error
  const triggerReportWebError = useCallback(async () => {
    if (!appId || !conversationId || isLoading) {
      toast.error("No se puede reportar el error web. Asegúrate de que haya un proyecto y chat activos.");
      return;
    }
    if (autoFixStatus !== 'idle') {
      toast.info("Ya hay un proceso de auto-corrección en curso. Por favor, espera a que termine.");
      return;
    }

    setAutoFixStatus('analyzing');

    try {
      // Fetch recent activity logs
      const activityResponse = await fetch(`/api/apps/${appId}/activity`);
      if (!activityResponse.ok) {
        const errorData = await activityResponse.json();
        throw new Error(errorData.message || `HTTP error! status: ${activityResponse.status}`);
      }
      const activityLogs = await activityResponse.json();
      
      const formattedActivityLogs = activityLogs.map((event: any) => 
        `[${new Date(event.created_at).toLocaleString()}] [${event.event_type}] ${event.description}`
      ).join('\n');

      const userMessageContent = `He reportado un error en la vista previa web de la aplicación. Aquí están los logs de actividad recientes del servidor:\n\n\`\`\`text\n${formattedActivityLogs || 'No se encontraron logs de actividad recientes.'}\n\`\`\`\n\n[USER_REPORTED_WEB_ERROR]`; // Internal prompt for AI

      const userMessage: Message = {
        id: `user-report-web-error-${Date.now()}`,
        conversation_id: conversationId,
        content: userMessageContent,
        role: 'user',
        timestamp: new Date(),
        type: 'text',
        isNew: true,
        isTyping: false,
        isConstructionPlan: false,
        planApproved: false,
        isCorrectionPlan: false,
        correctionApproved: false,
        isErrorAnalysisRequest: false,
        isAnimated: true,
      };
      setMessages(prev => [...prev, userMessage]);
      await getAndStreamAIResponse(conversationId, [...messages, userMessage]);
      // autoFixStatus will be set to 'plan_ready' by getAndStreamAIResponse if AI responds with a plan
    } catch (error: any) {
      console.error("Error fetching activity logs for web error report:", error);
      toast.error(`Error al obtener los logs de actividad para el reporte web: ${error.message}`);
      setAutoFixStatus('failed');
      // Add a message to the chat indicating the failure
      const errorMessage: Message = {
        id: `error-report-web-${Date.now()}`,
        conversation_id: conversationId,
        content: `Fallo al obtener los logs de actividad para el reporte web: ${error.message}. Por favor, inténtalo de nuevo o revisa los logs manualmente.`,
        role: 'assistant',
        timestamp: new Date(),
        type: 'text',
        isNew: true,
        isTyping: false,
        isConstructionPlan: false,
        planApproved: false,
        isCorrectionPlan: false,
        correctionApproved: false,
        isErrorAnalysisRequest: false,
        isAnimated: true,
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [appId, conversationId, isLoading, autoFixStatus, messages, getAndStreamAIResponse]);


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
    triggerFixBuildError, // NEW: Expose triggerFixBuildError
    triggerReportWebError, // NEW: Expose triggerReportWebError
  };
}