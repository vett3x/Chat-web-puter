"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User, Loader2, Check, Paperclip, XCircle } from 'lucide-react';
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
} from '@/components/ui/dropdown-menu';
import Image from 'next/image'; // Importar el componente Image de Next.js

// New types for multimodal content
interface PuterTextContentPart {
  type: 'text';
  text: string;
}

interface PuterImageContentPart {
  type: 'image_url';
  image_url: {
    url: string; // Can be data URL (base64) or public URL
  };
}

type PuterContentPart = PuterTextContentPart | PuterImageContentPart;

interface PuterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | PuterContentPart[]; // Updated to allow array of parts
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

interface Message {
  id: string;
  conversation_id?: string;
  content: string | PuterContentPart[]; // Updated
  role: 'user' | 'assistant';
  model?: string;
  timestamp: Date;
  isNew?: boolean;
  isTyping?: boolean;
  type?: 'text' | 'multimodal'; // Added type for easier rendering/storage
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
const DEFAULT_AI_MODEL = ALL_MODEL_VALUES[0]; // Define un modelo por defecto

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
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selected_ai_model') || DEFAULT_AI_MODEL;
    }
    return DEFAULT_AI_MODEL;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isPuterReady, setIsPuterReady] = useState(false);
  const [isSendingFirstMessageOfNewConversation, setIsSendingFirstMessageOfNewConversation] = useState(false);
  const [selectedImages, setSelectedImages] = useState<{ file: File; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('selected_ai_model', selectedModel);
    }
  }, [selectedModel]);

  const getConversationDetails = useCallback(async (convId: string) => {
    const { data, error } = await supabase
      .from('conversations')
      .select('id, title, model')
      .eq('id', convId)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching conversation details:', error.message || error.details || error);
      toast.error('Error al cargar los detalles de la conversación.');
      return null;
    }
    return data;
  }, [userId]);

  const getMessagesFromDB = useCallback(async (convId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('id, content, role, model, created_at, conversation_id, type')
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
      content: msg.content, // content is already jsonb, so it will be parsed correctly
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
        const conversationDetails = await getConversationDetails(conversationId);
        if (conversationDetails && conversationDetails.model) {
          setSelectedModel(conversationDetails.model);
        } else {
          // If conversation has no model, default to user's last selected or global default
          setSelectedModel(localStorage.getItem('selected_ai_model') || DEFAULT_AI_MODEL);
        }

        const fetchedMsgs = await getMessagesFromDB(conversationId);
        if (!isSendingFirstMessageOfNewConversation || fetchedMsgs.length > 0) {
          setMessages(fetchedMsgs);
        }
        setIsLoading(false);
      } else if (!conversationId) {
        setMessages([]);
        // When no conversation is selected, reset model to user's default
        setSelectedModel(localStorage.getItem('selected_ai_model') || DEFAULT_AI_MODEL);
      }
    };
    loadConversationData();
  }, [conversationId, userId, getMessagesFromDB, getConversationDetails, isSendingFirstMessageOfNewConversation]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, isLoading, selectedImages]); // Added selectedImages to dependencies

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
      .insert({ user_id: userId, title: newTitle, model: selectedModel }) // Guardar el modelo seleccionado
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

  const updateConversationModelInDB = async (convId: string, model: string) => {
    if (!userId) return;
    const { error } = await supabase
      .from('conversations')
      .update({ model: model })
      .eq('id', convId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating conversation model:', error.message || error.details || error);
      toast.error('Error al actualizar el modelo de la conversación.');
    } else {
      toast.success('Modelo de IA actualizado para esta conversación.');
    }
  };

  const handleModelChange = (modelValue: string) => {
    setSelectedModel(modelValue);
    if (conversationId) {
      updateConversationModelInDB(conversationId, modelValue);
    }
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
      content: msg.content, // content is now jsonb, so it will be stored as JSON
      model: msg.model,
      type: msg.type,
    }).select('id, created_at').single();

    if (error) {
      console.error('Error saving message:', error.message || error.details || error);
      toast.error('Error al guardar el mensaje en la base de datos.');
      return null;
    }
    return { id: data.id, timestamp: new Date(data.created_at) };
  };

  const processFiles = (files: FileList | null) => {
    if (!files) return;

    const filesArray = Array.from(files);
    const newImages: { file: File; preview: string }[] = [];

    filesArray.forEach(file => {
      if (file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024) { // 5MB limit
        const reader = new FileReader();
        reader.onloadend = () => {
          newImages.push({ file, preview: reader.result as string });
          if (newImages.length === filesArray.length) {
            setSelectedImages(prev => [...prev, ...newImages].slice(0, 4)); // Limit to 4 images
          }
        };
        reader.readAsDataURL(file);
      } else {
        toast.error('Solo se permiten imágenes de hasta 5MB.');
      }
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(event.target.files);
    event.target.value = ''; // Clear the input so the same file can be selected again
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (items) {
      let hasImage = false;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            // Directly process the pasted file
            if (file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024) { // 5MB limit
              const reader = new FileReader();
              reader.onloadend = () => {
                setSelectedImages(prev => {
                  const newImages = [...prev, { file, preview: reader.result as string }];
                  return newImages.slice(0, 4); // Limit to 4 images
                });
              };
              reader.readAsDataURL(file);
              hasImage = true;
              event.preventDefault(); // Prevent default paste behavior if an image is found
            } else {
              toast.error('Solo se permiten imágenes de hasta 5MB.');
            }
          }
        }
      }
      if (hasImage) {
        toast.info('Imagen pegada desde el portapapeles.');
      }
    }
  };

  const removeImage = (indexToRemove: number) => {
    setSelectedImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const sendMessage = async () => {
    if ((!inputMessage.trim() && selectedImages.length === 0) || isLoading || !isPuterReady || !userId) return;

    setIsLoading(true);
    const messageToSend = inputMessage;
    const imagesToSend = selectedImages;
    setInputMessage('');
    setSelectedImages([]);

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
        setSelectedImages(imagesToSend); // Restore images if conversation creation failed
        return;
      }
    }

    const finalConvId = currentConvId;

    const userContent: PuterContentPart[] = [];
    if (messageToSend.trim()) {
      userContent.push({ type: 'text', text: messageToSend });
    }
    imagesToSend.forEach(img => {
      userContent.push({ type: 'image_url', image_url: { url: img.preview } });
    });

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      conversation_id: finalConvId,
      content: userContent.length > 1 || imagesToSend.length > 0 ? userContent : messageToSend,
      role: 'user',
      timestamp: new Date(),
      type: imagesToSend.length > 0 ? 'multimodal' : 'text',
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
      type: 'text', // Placeholder type
    };
    setMessages(prev => [...prev, placeholderMessage]);

    try {
      const { data: historyData, error: historyError } = await supabase
        .from('messages')
        .select('content, role, type')
        .eq('conversation_id', finalConvId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (historyError) throw new Error('Error al cargar el historial para el contexto de la IA.');

      const puterMessages: PuterMessage[] = historyData.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content as string | PuterContentPart[] // Ensure content type matches PuterMessage
      }));

      const systemMessage: PuterMessage = {
        role: 'system',
        content: "Cuando generes un bloque de código, siempre debes especificar el lenguaje y un nombre de archivo descriptivo. Usa el formato ```language:filename.ext. Por ejemplo: ```python:chess_game.py. Esto es muy importante."
      };

      const response = await window.puter.ai.chat([systemMessage, ...puterMessages, { role: 'user', content: userContent }], { model: selectedModel });
      console.log('Puter AI response:', response);

      if (!response || (typeof response === 'object' && Object.keys(response).length === 0)) {
        throw new Error('La respuesta de la IA está vacía o tuvo un formato inesperado. Si es tu primera interacción en una nueva sesión, podría ser necesario completar una verificación de seguridad (ej. CAPTCHA) en el popup de Puter AI.');
      }
      if (response && response.error) {
        const apiErrorMessage = typeof response.error === 'string' ? response.error : (response.error.message || JSON.stringify(response.error));
        throw new Error(`Error de la IA: ${apiErrorMessage}`);
      }

      let assistantMessageContent: string | PuterContentPart[] = 'Sin contenido';
      let assistantMessageType: 'text' | 'multimodal' = 'text';

      if (response?.message?.content) {
        if (Array.isArray(response.message.content)) {
          assistantMessageContent = response.message.content.map((part: any) => {
            if (part.type === 'text') return { type: 'text', text: part.text };
            if (part.type === 'image_url') return { type: 'image_url', image_url: { url: part.image_url.url } };
            return { type: 'text', text: JSON.stringify(part) }; // Fallback for unknown parts
          });
          assistantMessageType = (assistantMessageContent as PuterContentPart[]).some((part: PuterContentPart) => part.type === 'image_url') ? 'multimodal' : 'text';
        } else if (typeof response.message.content === 'string') {
          assistantMessageContent = response.message.content;
          assistantMessageType = 'text';
        }
      } else if (typeof response?.content === 'string') {
        assistantMessageContent = response.content;
        assistantMessageType = 'text';
      } else {
        console.error('Unexpected AI response format:', response);
        throw new Error('La respuesta de la IA tuvo un formato inesperado.');
      }

      const assistantMessageData = {
        content: assistantMessageContent,
        role: 'assistant' as const,
        model: selectedModel,
        type: assistantMessageType,
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

        <div className="absolute bottom-0 left-0 right-0 flex justify-center px-4 pb-4 pt-2">
          <div className="w-full max-w-3xl bg-card rounded-xl border border-input shadow-lg p-2 flex flex-col gap-2 
                        focus-within:ring-2 focus-within:ring-green-500 focus-within:ring-offset-2 focus-within:ring-offset-background 
                        focus-within:shadow-[0_0_20px_5px_rgb(34_197_94_/_0.4)] transition-all duration-200">
            
            {selectedImages.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 border-b border-input">
                {selectedImages.map((img, index) => (
                  <div key={index} className="relative w-24 h-24 rounded-md overflow-hidden">
                    <Image
                      src={img.preview}
                      alt={`Preview ${index}`}
                      layout="fill"
                      objectFit="cover"
                      className="rounded-md"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-0 right-0 h-6 w-6 rounded-full bg-background/70 hover:bg-background text-destructive hover:text-destructive-foreground"
                      onClick={() => removeImage(index)}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                multiple
                className="hidden"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || selectedImages.length >= 4}
                className="flex-shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Adjuntar archivo"
              >
                <Paperclip className="h-5 w-5" />
              </Button>

              <Textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                onPaste={handlePaste} // Added onPaste handler
                placeholder="Pregunta a Claude AI..."
                disabled={isLoading || !userId}
                className="flex-1 border-none focus-visible:ring-0 focus-visible:ring-offset-0 resize-none max-h-[200px] overflow-y-auto bg-transparent"
                rows={1}
              />
              
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
                  className="w-64 bg-popover text-popover-foreground border-border rounded-lg"
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
                          onClick={() => handleModelChange(model.value)}
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
                disabled={isLoading || (!inputMessage.trim() && selectedImages.length === 0) || !userId}
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
    </div>
  );
}