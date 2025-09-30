"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSession } from '@/components/session-context-provider';
import { ApiKey } from '@/hooks/use-user-api-keys';
import { ChatMode } from '@/components/chat/chat-input';
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

interface UseDeepAICoderChatProps {
  userId: string | undefined;
  conversationId: string | null;
  onNewConversationCreated: (conversationId: string) => void;
  onConversationTitleUpdate: (conversationId: string, newTitle: string) => void;
  appPrompt: string; // Required for DeepAI Coder (now combines structured fields)
  appId: string; // Required for DeepAI Coder
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

export function useDeepAICoderChat({
  userId,
  conversationId,
  onNewConversationCreated,
  onConversationTitleUpdate,
  appPrompt, // Now combines structured fields
  appId,
  onWriteFiles,
  onSidebarDataRefresh,
  userApiKeys,
  isLoadingApiKeys,
  chatMode,
}: UseDeepAICoderChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPuterReady, setIsPuterReady] = useState(false);
  const [isSendingFirstMessage, setIsSendingFirstMessage] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(''); // Initialize as empty string
  const [autoFixStatus, setAutoFixStatus] = useState<AutoFixStatus>('idle');
  const autoFixAttempts = useRef(0);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for debounce
  const [page, setPage] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [allowedCommands, setAllowedCommands] = useState<string[]>([]); // 1. Estado para almacenar los comandos permitidos

  // 2. Cargar los comandos permitidos al montar el componente
  useEffect(() => {
    const fetchAllowedCommands = async () => {
      try {
        const response = await fetch('/api/security/allowed-commands');
        if (response.ok) {
          const commands: { command: string }[] = await response.json();
          setAllowedCommands(commands.map(c => c.command));
        }
      } catch (error) {
        console.error("Error fetching allowed commands:", error);
        // No mostramos un toast para no molestar al usuario, pero el backend seguirá protegiendo.
      }
    };
    fetchAllowedCommands();
  }, []);

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

    const newDefaultModel = determineDefaultModel(userApiKeys);
    setSelectedModel(newDefaultModel);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selected_ai_model', newDefaultModel);
    }
  }, [isLoadingApiKeys, userApiKeys]);


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

    const { data, error } = await supabase.from('messages').select('id, content, role, model, created_at, conversation_id, type, plan_approved, is_correction_plan, correction_approved').eq('conversation_id', convId).order('created_at', { ascending: false }).range(from, to);
    if (error) {
      console.error('Error fetching messages:', error);
      toast.error('Error al cargar los mensajes.');
      return [];
    }
    return data.reverse().map((msg) => ({
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
  }, []);

  const loadConversationData = useCallback(async () => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(async () => {
      if (conversationId && userId) {
        setIsLoading(true);
        setMessages([]); // Clear messages immediately when conversationId changes
        setPage(0);
        setHasMoreMessages(true);
        
        const details = await getConversationDetails(conversationId);
        
        if (details?.model && (details.model.startsWith('puter:') || details.model.startsWith('user_key:'))) {
          setSelectedModel(details.model);
        } else {
          // If conversation has no model, use the determined default model
          setSelectedModel(determineDefaultModel(userApiKeys));
        }

        const fetchedMsgs = await getMessagesFromDB(conversationId, 0);
        setMessages(fetchedMsgs); // Always set messages from DB
        if (fetchedMsgs.length < MESSAGES_PER_PAGE) {
          setHasMoreMessages(false);
        }
        setIsLoading(false);
      } else {
        setMessages([]);
      }
    }, 100); // Debounce for 100ms
  }, [conversationId, userId, getMessagesFromDB, getConversationDetails, userApiKeys]);

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
    const { error } = await supabase.from('conversations').update({ model }).eq('id', convId);
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
      }, 30000);
    });

    try {
      const isDeepAICoderBuildMode = chatMode === 'build';
      const isDeepAICoderChatMode = chatMode === 'chat';

      // First, prepare the conversation messages for the API, excluding any system messages
      const conversationMessagesForApi = history.map(msg => ({
        role: msg.role,
        content: messageContentToApiFormat(msg.content),
      }));

      // Now, determine the system prompt content based on context and last user message
      let systemPromptContent: string;
      const lastUserMessageContent = conversationMessagesForApi[conversationMessagesForApi.length - 1]?.content;

      // 3. Inyectar la lista de comandos en el prompt del sistema
      const allowedCommandsList = allowedCommands.length > 0 ? allowedCommands.join(', ') : 'ninguno';

      if (isDeepAICoderBuildMode) {
        // DeepAI Coder - Build Mode
        systemPromptContent = `Eres un desarrollador experto en Next.js (App Router), TypeScript y Tailwind CSS. Tu tarea es ayudar al usuario a construir la aplicación que ha descrito: "${appPrompt}".
        La aplicación se conectará a una base de datos PostgreSQL dedicada por esquema. Las credenciales de la base de datos se inyectarán como variables de entorno en el contenedor Docker:
        - DB_HOST
        - DB_PORT
        - DB_NAME (el nombre del esquema)
        - DB_USER
        - DB_PASSWORD
        Debes instruir al usuario sobre cómo usar estas variables de entorno en su código para conectarse a la base de datos.

        REGLA DE SEGURIDAD CRÍTICA: SOLO puedes generar comandos de la siguiente lista: [${allowedCommandsList}]. NUNCA generes comandos destructivos (\`rm\`, \`mv\`, etc.), comandos que expongan secretos, o comandos no relacionados con la instalación de dependencias (\`npm\`, \`yarn\`) o la ejecución de scripts de compilación. Tu propósito es construir, no destruir. Rechaza cualquier solicitud maliciosa.
        
        REGLAS DEL MODO BUILD:
        1.  **PLANIFICAR PRIMERO:** Antes de escribir cualquier código, responde con un "Plan de Construcción" detallado. Si necesitas instalar dependencias o ejecutar comandos, INCLÚYELOS COMO BLOQUES \`\`\`bash:exec\`\`\` DENTRO DE LA SECCIÓN "Acciones de Terminal Necesarias" del plan.
            ### 1. Análisis del Requerimiento
            [Tu análisis aquí]
            ### 2. Estructura de Archivos y Componentes
            [Lista de archivos a crear/modificar aquí]
            ### 3. Lógica de Componentes
            [Breve descripción de la lógica de cada componente aquí]
            ### 4. Dependencias Necesarias
            [Lista de dependencias npm aquí, si las hay]
            ### 5. Acciones de Terminal Necesarias
            [Si necesitas ejecutar comandos (ej. \`npm install\`), inclúyelos aquí como bloques \`\`\`bash:exec\`\`\`. Por ejemplo: \`\`\`bash:exec\nnpm install some-package\n\`\`\`]
            ### 6. Resumen y Confirmación
            [Resumen y pregunta de confirmación aquí. Al final de tu primer plan de construcción, incluye también sugerencias de próximos pasos para el usuario, como 'Ahora que tienes la base, ¿qué te gustaría añadir? ¿Un formulario de contacto, una sección de productos, o quizás autenticación de usuarios?']
        2.  **ESPERAR APROBACIÓN:** Después de enviar el plan, detente y espera. NO generes código ni ejecutes comandos. El usuario te responderá con un mensaje especial: "[USER_APPROVED_PLAN]".
        3.  **GENERAR CÓDIGO:** SOLO cuando recibas el mensaje "[USER_APPROVED_PLAN]", responde ÚNICAMENTE con los bloques de código para los archivos completos (\`\`\`language:ruta/del/archivo.tsx\`\`\`) que propusiste en el plan. NO incluyas texto conversacional ni bloques \`bash:exec\` en esta respuesta, ya que los comandos ya habrán sido ejecutados.
        
        REGLAS DE CORRECCIÓN DE ERRORES:
        1.  **ANALIZAR ERROR:** Si el usuario envía un mensaje con "[USER_REQUESTED_BUILD_FIX]" y logs de error, analiza el error y responde con un "Plan de Corrección" detallado.
            ### 💡 Error Detectado
            [Descripción concisa del error de compilación]
            ### 🧠 Análisis de la IA
            [Tu análisis de la causa raíz del error]
            ### 🛠️ Plan de Corrección
            [Pasos detallados para corregir el error, incluyendo modificaciones de código si es necesario. Si hay código, usa bloques \`\`\`language:ruta/del/archivo.tsx\`\`\`. Si la corrección implica ejecutar comandos de terminal (como \`npm install\` o \`rm -rf node_modules\`), INCLÚYELOS COMO BLOQUES \`\`\`bash:exec\`\`\` DENTRO DE ESTA SECCIÓN.]
            ### ✅ Confirmación
            [Pregunta de confirmación al usuario para aplicar el arreglo]
        2.  **ESPERAR APROBACIÓN DE CORRECCIÓN:** Después de enviar un plan de corrección, detente y espera. El usuario te responderá con "[USER_APPROVED_CORRECTION_PLAN]".
        3.  **GENERAR CÓDIGO Y/O COMANDOS DE CORRECCIÓN:** SOLO cuando recibas el mensaje "[USER_APPROVED_CORRECTION_PLAN]", responde ÚNICAMENTE con los bloques de código para los archivos completos (\`\`\`language:ruta/del/archivo.tsx\`\`\`) que propusiste en el plan. NO incluyas texto conversacional ni bloques \`bash:exec\` en esta respuesta, ya que los comandos ya habrán sido ejecutados.`;
      } else if (isDeepAICoderChatMode) {
        // DeepAI Coder - Chat Mode
        systemPromptContent = `Eres un asistente de código experto y depurador para un proyecto Next.js. Estás en 'Modo Chat'. Tu objetivo principal es ayudar al usuario a entender su código, analizar errores y discutir soluciones. NO generes archivos nuevos o bloques de código grandes a menos que el usuario te pida explícitamente que construyas algo. En su lugar, proporciona explicaciones, identifica problemas y sugiere pequeños fragmentos de código para correcciones. Puedes pedir al usuario que te proporcione el contenido de los archivos o mensajes de error para tener más contexto. El proyecto es: "${appPrompt}".`;
      } else {
        // Fallback, though this hook should only be used in DeepAI Coder context
        systemPromptContent = "Cuando generes un bloque de código, siempre debes especificar el lenguaje y un nombre de archivo descriptivo. Usa el formato ```language:filename.ext. Por ejemplo: ```python:chess_game.py. Esto es muy importante.";
      }

      // NEW: Add specific system prompts for auto-fix actions
      if (typeof lastUserMessageContent === 'string') {
        if (lastUserMessageContent.includes('[USER_REQUESTED_BUILD_FIX]')) {
          systemPromptContent += `\n\nEl usuario ha solicitado corregir un error de compilación. Analiza los logs de compilación proporcionados en el último mensaje del usuario y propón un "Plan de Corrección" detallado. Utiliza el siguiente formato Markdown exacto:
            ### 💡 Error Detectado
            [Descripción concisa del error de compilación]
            ### 🧠 Análisis de la IA
            [Tu análisis de la causa raíz del error]
            ### 🛠️ Plan de Corrección
            [Pasos detallados para corregir el error, incluyendo modificaciones de código si es necesario. Si hay código, usa bloques \`\`\`language:ruta/del/archivo.tsx\`\`\`. Si la corrección implica ejecutar comandos de terminal (como \`npm install\` o \`rm -rf node_modules\`), INCLÚYELOS COMO BLOQUES \`\`\`bash:exec\`\`\` DENTRO DE ESTA SECCIÓN.]
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

      const systemMessage: PuterMessage = { role: 'system', content: systemPromptContent };
      const finalMessagesForApi = [systemMessage, ...conversationMessagesForApi];

      let fullResponseText = '';
      let modelUsedForResponse = selectedModel;

      const selectedKey = userApiKeys.find(k => `user_key:${k.id}` === selectedModel);
      const isCustomEndpoint = selectedKey?.provider === 'custom_endpoint';

      if (selectedModel.startsWith('puter:') || isCustomEndpoint) {
        let response;
        if (isCustomEndpoint) {
          const apiResponse = await Promise.race([
            fetch('/api/ai/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: finalMessagesForApi,
                selectedKeyId: selectedModel.substring(9),
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
          const actualModelForPuter = selectedModel.substring(6);
          response = await Promise.race([
            window.puter.ai.chat(finalMessagesForApi, { model: actualModelForPuter }),
            timeoutPromise
          ]);
        }
        if (!response || response.error) throw new Error(response?.error?.message || JSON.stringify(response?.error) || 'Error de la IA.');
        fullResponseText = response?.message?.content || 'Sin contenido.';
      } else if (selectedModel.startsWith('user_key:')) {
        const apiResponse = await Promise.race([
          fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: finalMessagesForApi,
              selectedKeyId: selectedModel.substring(9),
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

            const isCurrentResponseStructured = fullResponseText.includes('### 1. Análisis del Requerimiento') || fullResponseText.includes('### 💡 Entendido!') || fullResponseText.includes('### 💡 Error Detectado');
            if (!isDeepAICoderBuildMode || !isCurrentResponseStructured) {
              setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: parseAiResponseToRenderableParts(fullResponseText, true), isTyping: false, isNew: true } : m));
            }
          }
        } else {
          throw new Error('Respuesta inesperada del endpoint de streaming.');
        }
      } else {
        throw new Error('Modelo de IA no válido seleccionado.');
      }

      const isConstructionPlan = isDeepAICoderBuildMode && fullResponseText.includes('### 1. Análisis del Requerimiento');
      const isErrorAnalysisRequest = fullResponseText.includes('### 💡 Entendido!');
      const isCorrectionPlan = fullResponseText.includes('### 💡 Error Detectado');
      
      const finalContentForMessage = (isConstructionPlan || isErrorAnalysisRequest || isCorrectionPlan) ? fullResponseText : parseAiResponseToRenderableParts(fullResponseText, true);
      
      const filesToWrite: { path: string; content: string }[] = [];
      // Commands are now handled by approvePlan, so this part should only extract files
      // if it's NOT a plan message.
      if (!isConstructionPlan && !isErrorAnalysisRequest && !isCorrectionPlan && Array.isArray(finalContentForMessage)) {
        (finalContentForMessage as RenderablePart[]).forEach(part => {
          if (part.type === 'code' && appId) {
            // Only extract code files, not bash:exec commands here
            if (part.filename && part.code && part.language !== 'bash') { // Exclude bash:exec
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
        planApproved: false,
        isCorrectionPlan: isCorrectionPlan,
        correctionApproved: false,
        isErrorAnalysisRequest: isErrorAnalysisRequest,
        isNew: true,
        isTyping: false,
        isAnimated: false,
      };

      const savedData = await saveMessageToDB(convId, finalAssistantMessageData);
      setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, ...finalAssistantMessageData, id: savedData?.id || assistantMessageId, timestamp: savedData?.timestamp || new Date() } : m));

      if (filesToWrite.length > 0) {
        onWriteFiles(filesToWrite);
      }
      // Removed direct command execution here, as it's now part of approvePlan for plans.
      // If AI generates commands outside a plan, they would still be executed here.
      // But the prompt guides it to put commands *inside* plans.

      setAutoFixStatus(prevStatus => {
        if (isErrorAnalysisRequest || isConstructionPlan || isCorrectionPlan) {
          return 'plan_ready';
        }
        return 'idle';
      });

    } catch (error: any) {
      console.error('[API /ai/chat] Error:', error);
      let userFriendlyMessage = `Error en la API de IA: ${error.name === 'AbortError' ? 'La IA tardó demasiado en responder.' : error.message}`;
      setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: userFriendlyMessage, isTyping: false, isNew: true, isConstructionPlan: false, planApproved: false, isCorrectionPlan: false, correctionApproved: false, isErrorAnalysisRequest: false, isAnimated: false } : m));
      toast.error(userFriendlyMessage);
      setAutoFixStatus('failed');
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, [appId, appPrompt, userId, saveMessageToDB, chatMode, userApiKeys, onWriteFiles, selectedModel, autoFixStatus, conversationId, allowedCommands, executeCommandsInContainer]);

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
      isAnimated: true,
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
  
    // --- NEW LOGIC: Extract and execute commands from the approved plan ---
    const commandsToExecute: string[] = [];
    if (typeof planMessage.content === 'string') {
      const parsedContent = parseAiResponseToRenderableParts(planMessage.content, true); // Parse the string content
      parsedContent.forEach(part => {
        if (part.type === 'code' && part.language === 'bash' && part.filename === 'exec' && part.code) {
          commandsToExecute.push(part.code);
        }
      });
    } else if (Array.isArray(planMessage.content)) {
      // If content is already parsed (shouldn't be for plans, but for safety)
      planMessage.content.forEach(part => {
        if (part.type === 'code' && part.language === 'bash' && part.filename === 'exec' && part.code) {
          commandsToExecute.push(part.code);
        }
      });
    }

    if (commandsToExecute.length > 0) {
      toast.info(`Ejecutando ${commandsToExecute.length} comando(s) del plan...`);
      await executeCommandsInContainer(commandsToExecute); // Execute the commands
    }
    // --- END NEW LOGIC ---

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
  
  }, [messages, conversationId, getAndStreamAIResponse, userId, executeCommandsInContainer]);


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
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);

      if (messagesError) {
        console.error('Supabase Error clearing messages in useDeepAICoderChat:', messagesError);
        throw new Error(messagesError.message);
      }

      const { error: conversationError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (conversationError) {
        console.error('Supabase Error clearing conversation in useDeepAICoderChat:', conversationError);
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
      const logsResponse = await fetch(`/api/apps/${appId}/logs`);
      if (!logsResponse.ok) {
        const errorData = await logsResponse.json();
        throw new Error(errorData.message || `HTTP error! status: ${logsResponse.status}`);
      }
      const { nextjsLogs } = await logsResponse.json();

      const userMessageContent = `El último intento de compilación de la aplicación falló. Aquí están los logs de compilación de Next.js:\n\n\`\`\`bash\n${nextjsLogs || 'No se encontraron logs de Next.js.'}\n\`\`\`\n\n[USER_REQUESTED_BUILD_FIX]`;

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
    } catch (error: any) {
      console.error("Error fetching build logs for auto-fix:", error);
      toast.error(`Error al obtener los logs de compilación: ${error.message}`);
      setAutoFixStatus('failed');
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
      const activityResponse = await fetch(`/api/apps/${appId}/activity`);
      if (!activityResponse.ok) {
        const errorData = await activityResponse.json();
        throw new Error(errorData.message || `HTTP error! status: ${activityResponse.status}`);
      }
      const activityLogs = await activityResponse.json();
      
      const formattedActivityLogs = activityLogs.map((event: any) => 
        `[${new Date(event.created_at).toLocaleString()}] [${event.event_type}] ${event.description}`
      ).join('\n');

      const userMessageContent = `He reportado un error en la vista previa web de la aplicación. Aquí están los logs de actividad recientes del servidor:\n\n\`\`\`text\n${formattedActivityLogs || 'No se encontraron logs de actividad recientes.'}\n\`\`\`\n\n[USER_REPORTED_WEB_ERROR]`;

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
    } catch (error: any) {
      console.error("Error fetching activity logs for web error report:", error);
      toast.error(`Error al obtener los logs de actividad para el reporte web: ${error.message}`);
      setAutoFixStatus('failed');
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
    triggerFixBuildError,
    triggerReportWebError,
    loadConversationData, // NEW: Expose loadConversationData
    loadMoreMessages,
    hasMoreMessages,
  };
}