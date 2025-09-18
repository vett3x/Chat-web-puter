"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User, Loader2, Check } from 'lucide-react'; // Añadido 'Check' para el indicador de selección
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/session-context-provider';
import { MessageContent } from './message-content';
import { Textarea } from '@/components/ui/textarea';
import ClaudeAILogo from './claude-ai-logo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'; // Importados componentes de DropdownMenu

interface Message {
  id: string;
  conversation_id?: string;
  content: string;
  role: 'user' | 'assistant';
  model?: string;
  timestamp: Date;
  isNew?: boolean;
  isTyping?: boolean;
}

const AI_PROVIDERS = [
  {
    company: 'Anthropic',
    logo: ClaudeAILogo,
    models: [
      { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
      { value: 'claude-opus-4', label: 'Claude Opus 4' },
      { value: 'claude-3-7-sonnet', label: 'Claude 3.7 Sonnet' },
      { value: 'claude-3-7-opus', label: 'Claude 3.7 Opus' },
    ],
  },
];

const ALL_MODEL_VALUES = AI_PROVIDERS.flatMap(provider => provider.models.map(model => model.value));

interface PuterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
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

interface ChatInterfaceProps {
  userId: string | undefined;
  conversationId: string | null;
  onNewConversationCreated: (conversationId: string) => void;
  onConversationTitleUpdate: (conversationId: string, newTitle: string) => void;
}

export function ChatInterface({
  userId,
  conversationId,
  onNewConversationCreated,
  onConversationTitleUpdate,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    // Inicializar desde localStorage o usar el primer modelo por defecto
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selected_ai_model') || ALL_MODEL_VALUES[0];
    }
    return ALL_MODEL_VALUES[0];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isPuterReady, setIsPuterReady] = useState(false);
  const [isSendingFirstMessageOfNewConversation, setIsSendingFirstMessageOfNewConversation] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

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

  // Efecto para guardar el modelo seleccionado en localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('selected_ai_model', selectedModel);
    }
  }, [selectedModel]);

  const getMessagesFromDB = useCallback(async (convId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('id, content, role, model, created_at, conversation_id')
      .eq('conversation_id', convId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error.message || error.details || error);
      toast.error('Error al cargar los mensajes de la conversación.');
      return [];
    }
    return data.map((msg) => ({
      id: msg.id,
      conversation_id: msg.conversation_id,
      content: msg.content,
      role: msg.role as 'user' | 'assistant',
      model: msg.model || undefined,
      timestamp: new Date(msg.created_at),
    }));
  }, [userId]);

  useEffect(() => {
    const loadMessages = async () => {
      if (conversationId && userId) {
        setIsLoading(true);
        const fetchedMsgs = await getMessagesFromDB(conversationId);
        if (!isSendingFirstMessageOfNewConversation || fetchedMsgs.length > 0) {
          setMessages(fetchedMsgs);
        }
        setIsLoading(false);
      } else if (!conversationId) {
        setMessages([]);
      }
    };
    loadMessages();
  }, [conversationId, userId, getMessagesFromDB, isSendingFirstMessageOfNewConversation]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  const createNewConversationInDB = async () => {
    if (!userId) {
      toast.error('Usuario no autenticado.');
      return null;
    }

    const { count, error: countError } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      console.error('Error fetching conversation count:', countError);
      toast.error('Error al obtener el número de conversaciones.');
      return null;
    }

    const newChatNumber = (count || 0) + 1;
    const newTitle = `Chat #${newChatNumber}`;

    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: userId, title: newTitle })
      .select('id, title')
      .single();

    if (error) {
      console.error('Error creating new conversation:', error.message || error.details || error);
      toast.error('Error al crear una nueva conversación.');
      return null;
    }
    onNewConversationCreated(data.id);
    onConversationTitleUpdate(data.id, data.title);
    return data.id;
  };

  const saveMessageToDB = async (convId: string, msg: Omit<Message, 'timestamp' | 'id'>) => {
    if (!userId) {
      toast.error('Usuario no autenticado.');
      return null;
    }
    const { data, error } = await supabase.from('messages').insert({
      conversation_id: convId,
      user_id: userId,
      role: msg.role,
      content: msg.content,
      model: msg.model,
    }).select('id, created_at').single();

    if (error) {
      console.error('Error saving message:', error.message || error.details || error);
      toast.error('Error al guardar el mensaje en la base de datos.');
      return null;
    }
    return { id: data.id, timestamp: new Date(data.created_at) };
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !isPuterReady || !userId) return;

    setIsLoading(true);
    const messageToSend = inputMessage;
    setInputMessage('');

    let currentConvId = conversationId;
    let isNewConversation = false;

    if (!currentConvId) {
      isNewConversation = true;
      setIsSendingFirstMessageOfNewConversation(true);
      currentConvId = await createNewConversationInDB();
      if (!currentConvId) {
        setIsLoading(false);
        setIsSendingFirstMessageOfNewConversation(false);
        setInputMessage(messageToSend);
        return;
      }
    }

    const finalConvId = currentConvId;

    const tempUserMessageId = `user-${Date.now()}`;
    const userMessage: Message = {
      id: tempUserMessageId,
      conversation_id: finalConvId,
      content: messageToSend,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    const tempAssistantId = `assistant-${Date.now()}`;
    const placeholderMessage: Message = {
      id: tempAssistantId,
      conversation_id: finalConvId,
      content: '',
      role: 'assistant',
      model: selectedModel,
      timestamp: new Date(),
      isTyping: true,
    };
    setMessages(prev => [...prev, placeholderMessage]);

    try {
      const { data: historyData, error: historyError } = await supabase
        .from('messages')
        .select('content, role')
        .eq('conversation_id', finalConvId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (historyError) throw new Error('Error al cargar el historial para el contexto de la IA.');

      const puterMessages: PuterMessage[] = historyData.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));

      const systemMessage: PuterMessage = {
        role: 'system',
        content: "Cuando generes un bloque de código, siempre debes especificar el lenguaje y un nombre de archivo descriptivo. Usa el formato ```language:filename.ext. Por ejemplo: ```python:chess_game.py. Esto es muy importante."
      };

      const response = await window.puter.ai.chat([systemMessage, ...puterMessages, { role: 'user', content: messageToSend }], { model: selectedModel });
      console.log('Puter AI response:', response);

      if (!response || (typeof response === 'object' && Object.keys(response).length === 0)) {
        throw new Error('La respuesta de la IA está vacía o tuvo un formato inesperado. Si es tu primera interacción en una nueva sesión, podría ser necesario completar una verificación de seguridad (ej. CAPTCHA) en el popup de Puter AI.');
      }
      if (response && response.error) {
        const apiErrorMessage = typeof response.error === 'string' ? response.error : (response.error.message || JSON.stringify(response.error));
        throw new Error(`Error de la IA: ${apiErrorMessage}`);
      }

      let messageContent = 'Sin contenido';
      if (response?.message?.content?.[0]?.text) {
        messageContent = response.message.content[0].text;
      } else if (typeof response?.content === 'string') {
        messageContent = response.content;
      } else {
        console.error('Unexpected AI response format:', response);
        throw new Error('La respuesta de la IA tuvo un formato inesperado.');
      }

      const assistantMessageData = {
        content: messageContent,
        role: 'assistant' as const,
        model: selectedModel,
      };

      setMessages(prev => prev.map(msg => msg.id === tempAssistantId ? { ...msg, ...assistantMessageData, isTyping: false, isNew: true } : msg));

      await saveMessageToDB(finalConvId, userMessage);
      saveMessageToDB(finalConvId, assistantMessageData).then(savedData => {
        if (savedData) {
          setMessages(prev => prev.map(msg => msg.id === tempAssistantId ? { ...msg, id: savedData.id, timestamp: savedData.timestamp } : msg));
        }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error desconocido.';
      toast.error(errorMessage);
      setMessages(prev => prev.map(msg => msg.id === tempAssistantId ? { ...msg, content: `Error: ${errorMessage}`, isTyping: false, isNew: true } : msg));
    } finally {
      setIsLoading(false);
      if (isNewConversation) {
        setIsSendingFirstMessageOfNewConversation(false);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isPuterReady) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando Puter AI...</p>
        </div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-muted-foreground">Por favor, inicia sesión para chatear.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 min-h-0 relative">
        <ScrollArea className="h-full" ref={scrollAreaRef}>
          <div className="p-4 space-y-4 pb-48">
            {messages.length === 0 && !isLoading ? (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>¡Hola! Soy Claude AI. ¿En qué puedo ayudarte hoy?</p>
                <p className="text-sm mt-2">Selecciona un modelo y comienza a chatear.</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`flex gap-3 max-w-[80%] ${
                      message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {message.role === 'user' ? (
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-avatar-user">
                          <User className="h-4 w-4 text-primary-foreground" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center shadow-avatar-ai">
                          <Bot className="h-4 w-4 text-secondary-foreground" />
                        </div>
                      )}
                    </div>
                    <div
                      className={`rounded-lg p-3 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      {message.isTyping ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Pensando...</span>
                        </div>
                      ) : (
                        <MessageContent content={message.content} isNew={!!message.isNew} />
                      )}
                      {message.model && !message.isTyping && (
                        <div className="text-xs opacity-70 mt-2">
                          {AI_PROVIDERS.flatMap(p => p.models).find(m => m.value === message.model)?.label}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="absolute bottom-16 left-0 right-0 flex justify-center px-4">
          <div className="w-full max-w-3xl bg-card rounded-xl border border-input shadow-lg p-2 flex items-center gap-2 
                        focus-within:ring-2 focus-within:ring-green-500 focus-within:ring-offset-2 focus-within:ring-offset-background 
                        focus-within:shadow-[0_0_20px_5px_rgb(34_197_94_/_0.4)] transition-all duration-200">
            <Textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Pregunta a Claude AI..."
              disabled={isLoading || !userId}
              className="flex-1 border-none focus-visible:ring-0 focus-visible:ring-offset-0 resize-none max-h-[200px] overflow-y-auto bg-transparent"
              rows={1}
            />
            
            {/* Botón redondo para la selección de IA */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="default"
                  size="icon"
                  className="rounded-full bg-info text-info-foreground shadow-avatar-user hover:shadow-avatar-user-hover transition-all duration-200"
                  aria-label="Seleccionar modelo de IA"
                >
                  <Bot className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                side="top" 
                align="end" 
                className="w-64 bg-popover text-popover-foreground border-border rounded-none"
              >
                <DropdownMenuLabel className="text-sm font-semibold">Seleccionar Modelo de IA</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border" />
                {AI_PROVIDERS.map((provider, providerIndex) => (
                  <React.Fragment key={provider.company}>
                    <DropdownMenuLabel className="flex items-center gap-2 font-bold text-foreground px-2 py-1.5">
                      <span>{provider.company}</span>
                      <provider.logo className="h-4 w-4" />
                    </DropdownMenuLabel>
                    {provider.models.map((model) => (
                      <DropdownMenuItem
                        key={model.value}
                        onClick={() => setSelectedModel(model.value)}
                        className="flex items-center justify-between cursor-pointer pl-8"
                      >
                        <span>{model.label}</span>
                        {selectedModel === model.value && <Check className="h-4 w-4 text-primary" />}
                      </DropdownMenuItem>
                    ))}
                    {providerIndex < AI_PROVIDERS.length - 1 && <DropdownMenuSeparator className="bg-border" />}
                  </React.Fragment>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              onClick={sendMessage}
              disabled={isLoading || !inputMessage.trim() || !userId}
              size="icon"
              className="flex-shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}