"use client";

import React, { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, User, Loader2, Clipboard, RefreshCw, Upload } from 'lucide-react';
import { MessageContent } from '@/components/message-content';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getModelLabel } from '@/lib/ai-models'; // Import the helper function
import { useUserApiKeys } from '@/hooks/use-user-api-keys';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; // NEW: Import Avatar components

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

interface Message {
  id: string;
  content: string | MessageContentPart[]; // Use the unified type
  role: 'user' | 'assistant';
  model?: string;
  isNew?: boolean;
  isTyping?: boolean;
  timestamp: Date;
  conversation_id?: string;
  type?: 'text' | 'multimodal';
}

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  aiResponseSpeed: 'slow' | 'normal' | 'fast';
  onRegenerate: () => void;
  onReapplyFiles: (message: Message) => void;
  appPrompt?: string | null;
  userAvatarUrl: string | null; // NEW: Prop for user avatar URL
}

export function ChatMessages({ messages, isLoading, aiResponseSpeed, onRegenerate, onReapplyFiles, appPrompt, userAvatarUrl }: ChatMessagesProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { userApiKeys } = useUserApiKeys();

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  const handleCopy = (content: string | MessageContentPart[]) => {
    let textToCopy = '';
    if (typeof content === 'string') {
      textToCopy = content;
    } else if (Array.isArray(content)) {
      textToCopy = content.map(part => (part.type === 'text' ? part.text : '')).join('\n');
    }
    navigator.clipboard.writeText(textToCopy);
    toast.success('Copiado al portapapeles.');
  };

  return (
    <ScrollArea className="h-full" ref={scrollAreaRef}>
      <div className="p-4 space-y-4 pb-48">
        {messages.length === 0 && !isLoading ? (
          <div className="text-center text-muted-foreground py-8">
            <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
            {appPrompt ? (
              <>
                <p className="font-semibold text-lg text-foreground">¡Todo listo para empezar a construir!</p>
                <p className="mt-2">Tu proyecto es: <span className="font-medium text-primary">"{appPrompt}"</span></p>
                <p className="text-sm mt-4">
                  Puedes empezar pidiendo algo como: <br />
                  <span className="font-mono bg-muted p-1 rounded-md text-xs">"Crea la página de inicio con una barra de navegación y un pie de página."</span>
                </p>
              </>
            ) : (
              <>
                <p>¡Hola! Soy Claude AI. ¿En qué puedo ayudarte hoy?</p>
                <p className="text-sm mt-2">Selecciona un modelo y comienza a chatear.</p>
              </>
            )}
          </div>
        ) : (
          messages.map((message, index) => {
            const isLastMessage = index === messages.length - 1;
            const hasFiles = Array.isArray(message.content) && message.content.some(part => (part as any).type === 'code' && (part as any).filename);

            return (
              <div
                key={message.id}
                className={`flex flex-col gap-1 ${message.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className={`group relative flex gap-3 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className="flex-shrink-0">
                    {message.role === 'user' ? (
                      <Avatar className="w-8 h-8 shadow-avatar-user"> {/* NEW: Use Avatar component */}
                        {userAvatarUrl && userAvatarUrl !== '' ? (
                          <AvatarImage src={userAvatarUrl} alt="User Avatar" />
                        ) : (
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        )}
                      </Avatar>
                    ) : (
                      <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center shadow-avatar-ai">
                        <Bot className="h-4 w-4 text-secondary-foreground" />
                      </div>
                    )}
                  </div>
                  <div className={`rounded-lg p-3 ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    {message.isTyping ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Pensando...</span>
                      </div>
                    ) : (
                      <MessageContent content={message.content as any} isNew={!!message.isNew} aiResponseSpeed={aiResponseSpeed} />
                    )}
                  </div>
                  {message.role === 'assistant' && !message.isTyping && (
                    <div className="absolute top-1/2 -translate-y-1/2 left-full ml-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(message.content)} title="Copiar">
                        <Clipboard className="h-3.5 w-3.5" />
                      </Button>
                      {hasFiles && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onReapplyFiles(message)} disabled={isLoading} title="Reaplicar archivos">
                          <Upload className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {isLastMessage && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRegenerate} disabled={isLoading} title="Regenerar">
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {message.role === 'assistant' && !message.isTyping && message.model && (
                  <p className="text-xs text-muted-foreground px-12">
                    ✓ Generado con {getModelLabel(message.model, userApiKeys)}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </ScrollArea>
  );
}