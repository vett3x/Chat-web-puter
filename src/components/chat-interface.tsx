"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User, Loader2, MessageSquarePlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/session-context-provider';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  model?: string;
  timestamp: Date;
}

const AVAILABLE_MODELS = [
  { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
  { value: 'claude-opus-4', label: 'Claude Opus 4' },
  { value: 'claude-3-7-sonnet', label: 'Claude 3.7 Sonnet' },
  { value: 'claude-3-7-opus', label: 'Claude 3.7 Opus' },
];

interface PuterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface PuterAIResponse {
  id?: string;
  type?: string;
  role?: string;
  model?: string;
  content?: string;
  stop_reason?: string;
  stop_sequence?: string;
  usage?: any;
  message?: {
    content: Array<{
      text: string;
    }>;
  };
}

declare global {
  interface Window {
    puter: {
      ai: {
        chat: (messages: PuterMessage[], options: { model: string }) => Promise<PuterAIResponse>;
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
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4');
  const [isLoading, setIsLoading] = useState(false);
  const [isPuterReady, setIsPuterReady] = useState(false);
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [isContextInitialized, setIsContextInitialized] = useState(false);
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

  const fetchMessages = useCallback(async (convId: string) => {
    setIsLoading(true);
    setIsContextInitialized(false);
    const { data, error } = await supabase
      .from('messages')
      .select('id, content, role, model, created_at')
      .eq('conversation_id', convId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error.message || error.details || error);
      toast.error('Error al cargar los mensajes de la conversación.');
      setMessages([]);
    } else {
      setMessages(
        data.map((msg) => ({
          id: msg.id,
          content: msg.content,
          role: msg.role as 'user' | 'assistant',
          model: msg.model || undefined,
          timestamp: new Date(msg.created_at),
        }))
      );
      setIsContextInitialized(true);
    }
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    if (conversationId && userId) {
      fetchMessages(conversationId);
    } else {
      setMessages([]);
      setIsContextInitialized(false);
    }
  }, [conversationId, userId, fetchMessages]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, isLoading, isContextLoading]);

  const createNewConversationInDB = async (initialMessageContent: string) => {
    if (!userId) {
      toast.error('Usuario no autenticado.');
      return null;
    }

    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: userId, title: initialMessageContent.substring(0, 50) + '...' })
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

  const saveMessageToDB = async (convId: string, msg: Message) => {
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
    }).select('id, content, role, model, created_at').single();

    if (error) {
      console.error('Error saving message:', error.message || error.details || error);
      toast.error('Error al guardar el mensaje en la base de datos.');
      return null;
    }
    return {
      id: data.id,
      content: data.content,
      role: data.role as 'user' | 'assistant',
      model: data.model || undefined,
      timestamp: new Date(data.created_at),
    };
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !isPuterReady || !userId) return;

    const tempUserMessageId = Date.now().toString();
    const userMessage: Message = {
      id: tempUserMessageId,
      content: inputMessage,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    let currentConvId = conversationId;
    let shouldFetchContextFromDB = false;
    let tempAssistantMessageId: string | null = null;

    if (!currentConvId) {
      shouldFetchContextFromDB = true;
      currentConvId = await createNewConversationInDB(userMessage.content);
      if (!currentConvId) {
        setIsLoading(false);
        return;
      }
    }

    const savedUserMessage = await saveMessageToDB(currentConvId, userMessage);
    if (!savedUserMessage) {
      setIsLoading(false);
      setMessages(prev => prev.filter(msg => msg.id !== tempUserMessageId));
      return;
    }
    setMessages(prev => prev.map(msg => msg.id === tempUserMessageId ? savedUserMessage : msg));

    try {
      let puterMessages: PuterMessage[] = [];
      const currentMessages = [...messages, savedUserMessage];

      if (!isContextInitialized || shouldFetchContextFromDB) {
        setIsContextLoading(true);
        const { data: historyData, error: historyError } = await supabase
          .from('messages')
          .select('content, role')
          .eq('conversation_id', currentConvId)
          .eq('user_id', userId)
          .order('created_at', { ascending: true });

        if (historyError) {
          throw new Error('Error al cargar el historial para el contexto de la IA.');
        }
        puterMessages = historyData.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }));
        setIsContextInitialized(true);
      } else {
        puterMessages = currentMessages.map(msg => ({
          role: msg.role,
          content: msg.content
        }));
      }

      const response = await window.puter.ai.chat(puterMessages, {
        model: selectedModel
      });
      setIsContextLoading(false);

      let messageContent = response?.message?.content?.[0]?.text || 'Sin contenido';

      tempAssistantMessageId = (Date.now() + 1).toString();
      const streamingAssistantMessage: Message = {
          id: tempAssistantMessageId,
          content: '',
          role: 'assistant',
          model: selectedModel,
          timestamp: new Date(),
      };
      setMessages(prev => [...prev, streamingAssistantMessage]);

      let charIndex = 0;
      const typingInterval = setInterval(() => {
          if (charIndex < messageContent.length) {
              setMessages(prev =>
                  prev.map(msg =>
                      msg.id === tempAssistantMessageId
                          ? { ...msg, content: messageContent.substring(0, charIndex + 1) }
                          : msg
                  )
              );
              charIndex++;
          } else {
              clearInterval(typingInterval);
              const finalAssistantMessage: Message = {
                  id: tempAssistantMessageId!,
                  content: messageContent,
                  role: 'assistant',
                  model: selectedModel,
                  timestamp: new Date(),
              };
              saveMessageToDB(currentConvId!, finalAssistantMessage).then(savedMsg => {
                  if (savedMsg) {
                      setMessages(prev =>
                          prev.map(msg =>
                              msg.id === tempAssistantMessageId ? savedMsg : msg
                          )
                      );
                  }
                  setIsLoading(false);
              });
          }
      }, 5);

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error((error as Error).message || 'Error al enviar el mensaje. Por favor, intenta de nuevo.');
      setIsLoading(false);
      setIsContextLoading(false);
      if (tempAssistantMessageId) {
        setMessages(prev => prev.filter(msg => msg.id !== tempAssistantMessageId));
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startNewChat = () => {
    setMessages([]);
    onNewConversationCreated(null as any);
    setIsContextInitialized(false);
    toast.success('Nuevo chat iniciado');
  };

  const lastMessage = messages[messages.length - 1];
  const isAIThinking = isLoading && lastMessage?.role === 'user';

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
      <CardHeader className="flex-shrink-0 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-6 w-6" />
            Chat con Claude AI
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_MODELS.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={startNewChat}>
              <MessageSquarePlus className="h-4 w-4 mr-2" /> Nuevo Chat
            </Button>
          </div>
        </div>
      </CardHeader>

      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full" ref={scrollAreaRef}>
          <div className="p-4 space-y-4">
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
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-primary-foreground" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
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
                      <div className="whitespace-pre-wrap">{message.content}</div>
                      {message.model && (
                        <div className="text-xs opacity-70 mt-2">
                          {AVAILABLE_MODELS.find(m => m.value === message.model)?.label}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            {isAIThinking && (
              <div className="flex gap-3 justify-start">
                <div className="flex gap-3 max-w-[80%]">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                      <Bot className="h-4 w-4 text-secondary-foreground" />
                    </div>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Pensando...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {isContextLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex gap-3 max-w-[80%]">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                      <Bot className="h-4 w-4 text-secondary-foreground" />
                    </div>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Cargando contexto...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="border-t p-4 flex-shrink-0 bg-muted/40">
        <div className="flex gap-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Escribe tu mensaje aquí..."
            disabled={isLoading || !userId}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={isLoading || !inputMessage.trim() || !userId}
            size="icon"
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
  );
}