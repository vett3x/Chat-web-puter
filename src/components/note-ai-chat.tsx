"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send, Loader2, Bot, User } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface PuterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface NoteAiChatProps {
  isOpen: boolean;
  onClose: () => void;
  noteTitle: string;
  noteContent: string;
}

export function NoteAiChat({ isOpen, onClose, noteTitle, noteContent }: NoteAiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMessages([{ role: 'assistant', content: 'Hola, soy tu asistente. Pregúntame cualquier cosa sobre esta nota.' }]);
      setUserInput('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!userInput.trim() || isLoading) return;

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userInput }];
    setMessages(newMessages);
    setUserInput('');
    setIsLoading(true);

    try {
      const systemPrompt = `Eres un asistente de IA experto que ayuda a un usuario con su nota. La nota del usuario se proporciona a continuación, delimitada por '---'. Tu tarea es responder a la pregunta del usuario basándote únicamente en el contexto de esta nota. Sé conciso y directo.
---
Título: ${noteTitle}

Contenido:
${noteContent}
---
Ahora, por favor responde a la siguiente pregunta del usuario:`;

      const puterMessages: PuterMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput },
      ];

      toast.info("Leyendo nota y generando respuesta...");
      const response = await window.puter.ai.chat(puterMessages, { model: 'claude-sonnet-4' });

      if (!response || response.error) {
        throw new Error(response?.error?.message || 'Error de la IA.');
      }

      const assistantResponse = response?.message?.content || 'No se pudo obtener una respuesta.';
      
      let responseText = '';
      if (typeof assistantResponse === 'string') {
        responseText = assistantResponse;
      } else if (Array.isArray(assistantResponse)) {
        responseText = assistantResponse
          .filter(part => part.type === 'text' && part.text)
          .map(part => part.text)
          .join('\n\n');
      } else {
        responseText = 'Respuesta con formato no soportado.';
        console.warn('Unsupported AI response format:', assistantResponse);
      }

      setMessages([...newMessages, { role: 'assistant', content: responseText }]);

    } catch (error: any) {
      toast.error(error.message);
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Card className="absolute bottom-20 right-4 w-96 h-[500px] z-20 flex flex-col shadow-2xl animate-in fade-in-0 slide-in-from-bottom-4 slide-in-from-right-4 duration-300">
      <CardHeader className="flex flex-row items-center justify-between p-3 border-b">
        <CardTitle className="text-base font-semibold">Asistente de Nota</CardTitle>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollAreaRef}>
          <div className="p-4 space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className="flex-shrink-0">
                    {msg.role === 'user' ? (
                      <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center"><User className="h-3 w-3 text-primary-foreground" /></div>
                    ) : (
                      <div className="w-6 h-6 bg-secondary rounded-full flex items-center justify-center"><Bot className="h-3 w-3 text-secondary-foreground" /></div>
                    )}
                  </div>
                  <div className={`rounded-lg p-2 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Pensando...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-2 border-t">
        <div className="flex w-full items-center gap-2">
          <Textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
            placeholder="Pregunta sobre tu nota..."
            disabled={isLoading}
            className="flex-1 resize-none min-h-10"
            rows={1}
          />
          <Button onClick={handleSendMessage} disabled={isLoading || !userInput.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}