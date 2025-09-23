"use client";

import React, { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, User, Loader2 } from 'lucide-react';
import { MessageContent } from '@/components/message-content';

// Define types
interface PuterTextContentPart {
  type: 'text';
  text: string;
}

interface PuterImageContentPart {
  type: 'image_url';
  image_url: {
    url: string;
  };
}

type PuterContentPart = PuterTextContentPart | PuterImageContentPart;

interface Message {
  id: string;
  content: string | PuterContentPart[];
  role: 'user' | 'assistant';
  model?: string;
  isNew?: boolean;
  isTyping?: boolean;
}

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  aiResponseSpeed: 'slow' | 'normal' | 'fast';
}

export function ChatMessages({ messages, isLoading, aiResponseSpeed }: ChatMessagesProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  return (
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
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
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
                <div className={`rounded-lg p-3 ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  {message.isTyping ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Pensando...</span>
                    </div>
                  ) : (
                    <MessageContent content={message.content} isNew={!!message.isNew} aiResponseSpeed={aiResponseSpeed} />
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
}