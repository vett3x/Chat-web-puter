"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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

interface PuterAIResponse {
  id?: string;
  type?: string;
  role?: string;
  model?: string;
  content?: string;
  stop_reason?: string;
  stop_sequence?: string;
  usage?: any;
  message?: string;
  toString?: () => string;
  valueOf?: () => string;
}

declare global {
  interface Window {
    puter: {
      ai: {
        chat: (message: string, options: { model: string }) => Promise<PuterAIResponse | string>;
      };
    };
  }
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4');
  const [isLoading, setIsLoading] = useState(false);
  const [isPuterReady, setIsPuterReady] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if Puter is available
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
    // Auto scroll to bottom when new messages are added
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !isPuterReady) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await window.puter.ai.chat(inputMessage, { 
        model: selectedModel 
      });

      // Extract the message content from the response object
      let messageContent: string;
      if (typeof response === 'string') {
        messageContent = response;
      } else if (response && typeof response === 'object') {
        // Try different possible content properties
        if ('content' in response && response.content) {
          messageContent = response.content;
        } else if ('message' in response && response.message) {
          messageContent = response.message;
        } else if (typeof (response as any).toString === 'function') {
          messageContent = (response as any).toString();
        } else {
          // Fallback: try to extract any string value from the object
          const stringValues = Object.values(response).filter(val => typeof val === 'string');
          messageContent = stringValues.length > 0 ? stringValues[0] : 'Error: No se pudo obtener la respuesta';
        }
      } else {
        messageContent = 'Error: Respuesta inválida del servidor';
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: messageContent,
        role: 'assistant',
        model: selectedModel,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Error al enviar el mensaje. Por favor, intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    toast.success('Chat limpiado');
  };

  if (!isPuterReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando Puter AI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl h-screen flex flex-col p-4">
      <Card className="flex-1 flex flex-col">
        <CardHeader className="flex-shrink-0">
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
              <Button variant="outline" size="sm" onClick={clearChat}>
                Limpiar
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0">
          <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.length === 0 ? (
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
              {isLoading && (
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
                        <span className="text-sm">Escribiendo...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t p-4">
            <div className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Escribe tu mensaje aquí..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button 
                onClick={sendMessage} 
                disabled={isLoading || !inputMessage.trim()}
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
        </CardContent>
      </Card>
    </div>
  );
}