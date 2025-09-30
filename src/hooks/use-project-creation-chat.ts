"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { ApiKey } from '@/hooks/use-user-api-keys';
import { AI_PROVIDERS } from '@/lib/ai-models';
import { parseAiResponseToRenderableParts, RenderablePart } from '@/lib/utils';
import { Message } from './use-general-chat'; // Reusing Message type

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

// Function to determine the default model based on user preferences and available keys
const determineDefaultModel = (userApiKeys: ApiKey[]): string => {
  // Prioritize the specific global Gemini 2.5 Flash model
  const globalGeminiFlashKey = userApiKeys.find(key => 
    key.is_global && key.provider === 'google_gemini' && key.model_name === 'gemini-2.5-flash' && !key.use_vertex_ai
  );
  if (globalGeminiFlashKey) {
    return `user_key:${globalGeminiFlashKey.id}`;
  }

  // Fallback to any other global key
  const globalKey = userApiKeys.find(key => key.is_global);
  if (globalKey) {
    return `user_key:${globalKey.id}`;
  }

  // Fallback to a Puter.js Claude model if no global keys are found
  const claudeModel = AI_PROVIDERS.find(p => p.value === 'anthropic_claude')?.models[0];
  if (claudeModel) {
    return `puter:${claudeModel.value}`;
  }

  // Final fallback if nothing else works
  return 'puter:claude-sonnet-4';
};

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

interface ProjectDetails {
  name: string;
  main_purpose: string;
  key_features?: string;
  preferred_technologies?: string;
}

interface UseProjectCreationChatProps {
  userId: string | undefined;
  userApiKeys: ApiKey[];
  isLoadingApiKeys: boolean;
  onProjectDetailsGathered: (details: ProjectDetails) => void;
}

export function useProjectCreationChat({
  userId,
  userApiKeys,
  isLoadingApiKeys,
  onProjectDetailsGathered,
}: UseProjectCreationChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPuterReady, setIsPuterReady] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(''); // Will be set by determineDefaultModel
  const [projectDetails, setProjectDetails] = useState<ProjectDetails>({
    name: '',
    main_purpose: '',
    key_features: '',
    preferred_technologies: '',
  });
  const [isReadyToCreate, setIsReadyToCreate] = useState(false);
  const currentQuestion = useRef(0); // Track which question the AI is currently asking

  const questions = [
    "¡Hola! Soy tu asistente para crear proyectos. ¿Cómo se llamará tu aplicación?",
    "Perfecto. Ahora, ¿cuál es el propósito principal de tu aplicación? Sé lo más descriptivo posible.",
    "Entendido. ¿Hay alguna característica clave o funcionalidad específica que te gustaría incluir en tu aplicación? (O puedes decir 'no' si no tienes preferencias por ahora).",
    "Genial. Finalmente, ¿tienes alguna tecnología o framework preferido que te gustaría usar, además de Next.js, TypeScript y Tailwind CSS? (O puedes decir 'no' si no tienes preferencias adicionales).",
  ];

  const systemPrompt = `Eres un asistente de IA especializado en la creación de proyectos Next.js. Tu objetivo es guiar al usuario para recopilar la siguiente información de un nuevo proyecto, **haciendo una pregunta a la vez y esperando la respuesta del usuario**:
1.  **Nombre del Proyecto** (requerido)
2.  **Propósito Principal de la Aplicación** (requerido)
3.  **Características Clave** (opcional)
4.  **Tecnologías Preferidas** (opcional, aunque la base es Next.js, TypeScript, Tailwind CSS, el usuario puede especificar más)

Tu interacción debe ser conversacional, amigable y **elegante**. Haz preguntas claras para obtener cada pieza de información. **NO hagas la siguiente pregunta hasta que el usuario haya respondido a la anterior.**

Una vez que hayas recopilado el "Nombre del Proyecto" y el "Propósito Principal", y hayas preguntado por las "Características Clave" y "Tecnologías Preferidas" (incluso si el usuario dice que no tiene preferencias), debes indicar que estás listo para crear la aplicación.

Cuando hayas recopilado **toda la información necesaria**, responde con un mensaje que contenga el siguiente formato JSON al final, además de tu texto conversacional. **Este JSON solo debe aparecer en la respuesta final, una vez que toda la información esté completa.**

\`\`\`json
{
  "status": "ready_to_create",
  "project_name": "[Nombre del Proyecto]",
  "main_purpose": "[Propósito Principal]",
  "key_features": "[Características Clave o 'No especificado']",
  "preferred_technologies": "[Tecnologías Preferidas o 'No especificado']"
}
\`\`\`

Hasta que no tengas al menos el nombre y el propósito principal, sigue preguntando. Si el usuario te da múltiples piezas de información en un solo mensaje, extráelas y actualiza tu estado interno. Sé proactivo en la conversación, pero siempre espera la respuesta a la pregunta actual antes de pasar a la siguiente.`;

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
    if (isLoadingApiKeys) return;
    setSelectedModel(determineDefaultModel(userApiKeys));
  }, [isLoadingApiKeys, userApiKeys]);

  useEffect(() => {
    if (!userId || !isPuterReady || isLoading || messages.length > 0) return;

    // Initial message from AI to start the conversation
    const initialAiMessage: Message = {
      id: `assistant-initial-${Date.now()}`,
      role: 'assistant',
      content: questions[0], // Start with the first question
      timestamp: new Date(),
      isNew: true,
      isTyping: false,
      isConstructionPlan: false,
      planApproved: false,
      isCorrectionPlan: false,
      correctionApproved: false,
      isErrorAnalysisRequest: false,
      isAnimated: true,
    };
    setMessages([initialAiMessage]);
    currentQuestion.current = 0; // Reset current question index
  }, [userId, isPuterReady, isLoading, messages.length]);

  const processAiResponse = useCallback((responseText: string) => {
    const jsonRegex = /```json\n([\s\S]*?)\n```/;
    const match = responseText.match(jsonRegex);

    if (match && match[1]) {
      try {
        const parsedJson = JSON.parse(match[1]);
        if (parsedJson.status === 'ready_to_create') {
          setProjectDetails({
            name: parsedJson.project_name,
            main_purpose: parsedJson.main_purpose,
            key_features: parsedJson.key_features === 'No especificado' ? '' : parsedJson.key_features,
            preferred_technologies: parsedJson.preferred_technologies === 'No especificado' ? '' : parsedJson.preferred_technologies,
          });
          setIsReadyToCreate(true);
          onProjectDetailsGathered({
            name: parsedJson.project_name,
            main_purpose: parsedJson.main_purpose,
            key_features: parsedJson.key_features === 'No especificado' ? '' : parsedJson.key_features,
            preferred_technologies: parsedJson.preferred_technologies === 'No especificado' ? '' : parsedJson.preferred_technologies,
          });
        }
      } catch (e) {
        console.error("Error parsing AI's JSON response:", e);
      }
    }
  }, [onProjectDetailsGathered]);

  const getAndStreamAIResponse = useCallback(async (history: Message[]) => {
    setIsLoading(true);
    const assistantMessageId = `assistant-${Date.now()}`;
    
    setMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: '', isTyping: true, isNew: true, isConstructionPlan: false, planApproved: false, isCorrectionPlan: false, correctionApproved: false, isErrorAnalysisRequest: false, isAnimated: false, timestamp: new Date() }]);
    
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined = undefined;

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error('La IA tardó demasiado en responder. Por favor, inténtalo de nuevo.'));
      }, 30000);
    });

    try {
      const messagesForApi = history.map(msg => ({
        role: msg.role,
        content: messageContentToApiFormat(msg.content),
      }));
      
      const systemMessage: PuterMessage = { role: 'system', content: systemPrompt };
      const finalMessagesForApi = [systemMessage, ...messagesForApi];

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
            setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: parseAiResponseToRenderableParts(fullResponseText, false), isTyping: false, isNew: true } : m));
          }
        } else {
          throw new Error('Respuesta inesperada del endpoint de streaming.');
        }
      } else {
        throw new Error('Modelo de IA no válido seleccionado.');
      }
      
      const finalContentForMessage = parseAiResponseToRenderableParts(fullResponseText, false);
      
      setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: finalContentForMessage, isTyping: false, isNew: true, model: modelUsedForResponse } : m));
      processAiResponse(fullResponseText); // Process the full response for JSON
    } catch (error: any) {
      console.error('[Project Creation Chat] Error:', error);
      let userFriendlyMessage = `Error en la API de IA: ${error.name === 'AbortError' ? 'La IA tardó demasiado en responder.' : error.message}`;
      setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: userFriendlyMessage, isTyping: false, isNew: true, isConstructionPlan: false, planApproved: false, isCorrectionPlan: false, correctionApproved: false, isErrorAnalysisRequest: false, isAnimated: false } : m));
      toast.error(userFriendlyMessage);
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, [selectedModel, userApiKeys, systemPrompt, processAiResponse]);

  const sendMessage = useCallback(async (userInput: string) => {
    if (!userInput.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userInput,
      timestamp: new Date(),
      isNew: true,
      isTyping: false,
      isConstructionPlan: false,
      planApproved: false,
      isCorrectionPlan: false,
      correctionApproved: false,
      isErrorAnalysisRequest: false,
      isAnimated: true,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    await getAndStreamAIResponse(newMessages);
  }, [isLoading, messages, getAndStreamAIResponse]);

  return {
    messages,
    isLoading,
    isPuterReady,
    selectedModel,
    handleModelChange: setSelectedModel,
    sendMessage,
    projectDetails,
    isReadyToCreate,
  };
}