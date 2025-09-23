"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send, Loader2, Bot, User, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import ClaudeAILogo from '@/components/claude-ai-logo';

interface PuterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const AI_MODELS = [
  { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
  { value: 'claude-opus-4', label: 'Claude Opus 4' },
];

interface NoteAiChatProps {
  isOpen: boolean;
  onClose: () => void;
  noteTitle: string;
  noteContent: string;
  initialChatHistory: ChatMessage[] | null;
  onSaveHistory: (history: ChatMessage[]) => void;
}

export function NoteAiChat({ isOpen, onClose, noteTitle, noteContent, initialChatHistory, onSaveHistory }: NoteAiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(AI_MODELS[0].value);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const defaultWelcomeMessage: ChatMessage = { role: 'assistant', content: 'Hola, soy tu asistente. Pregúntame cualquier cosa sobre esta nota.' };

  useEffect(() => {
    if (isOpen) {
      setMessages(initialChatHistory && initialChatHistory.length > 0 ? initialChatHistory : [defaultWelcomeMessage]);
      setUserInput('');
    }
  }, [isOpen, initialChatHistory]);

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
      const systemPrompt = `Eres un asistente de IA experto que ayuda a un usuario con su nota. La nota del usuario se proporciona a continuación, delimitada por '---'. Tu tarea es responder a las preguntas del usuario basándote únicamente en el contexto de esta nota y la conversación actual. Sé conciso y directo.
---
Título: ${noteTitle}
Contenido:
${noteContent}
---`;

      const puterMessages: PuterMessage[] = [
        { role: 'system', content: systemPrompt },
        ...newMessages.map(msg => ({ role: msg.role, content: msg.content }))
      ];

      const response = await window.puter.ai.chat(puterMessages, { model: selectedModel });

      if (!response || response.error) {
        throw new Error(response?.error?.message || 'La IA devolvió una respuesta de error.');
      }

      const assistantResponse = response?.message?.content || 'No se pudo obtener una respuesta.';
      
      let responseText = '';
      if (typeof assistantResponse === 'string') {
        responseText = assistantResponse;
      } else if (Array.isArray(assistantResponse)) {
        responseText = assistantResponse.filter(part => part.type === 'text' && part.text).map(part => part.text).join('\n\n');
      } else {
        responseText = 'Respuesta con formato no soportado.';
      }

      const finalMessages = [...newMessages, { role: 'assistant' as const, content: responseText }];
      setMessages(finalMessages);
      onSaveHistory(finalMessages);

    } catch (error: any) {
      const errorMessage = error?.message || 'Ocurrió un error desconocido.';
      toast.error(errorMessage);
      setMessages([...newMessages, { role: 'assistant' as const, content: `Error: ${errorMessage}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([defaultWelcomeMessage]);
    onSaveHistory([defaultWelcomeMessage]);
    toast.success('Historial del chat limpiado.');
  };

  if (!isOpen) return null;

  return (
    <Card className="absolute bottom-20 right-4 w-96 h-[500px] z-20 flex flex-col shadow-2xl animate-in fade-in-0 slide-in-from-bottom-4 slide-in-from-right-4 duration-300">
      <CardHeader className="flex flex-row items-center justify-between p-3 border-b">
        <CardTitle className="text-base font-semibold">Asistente de Nota</CardTitle>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" title="Cambiar modelo de IA">
                <ClaudeAILogo className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {AI_MODELS.map(model => (
                <DropdownMenuItem key={model.value} onClick={() => setSelectedModel(model.value)} className={cn("flex items-center justify-between", selectedModel === model.value && "bg-accent")}>
                  <span>{model.label}</span>
                  {selectedModel === model.value && <Check className="h-4 w-4 text-green-500" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" title="Limpiar chat">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>¿Limpiar el chat?</AlertDialogTitle><AlertDialogDescription>Esto eliminará permanentemente el historial de esta conversación.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleClearChat}>Limpiar</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollAreaRef}>
          <div className="p-4 space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className="flex-shrink-0">
                    {msg.role === 'user' ? (<div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center"><User className="h-3 w-3 text-primary-foreground" /></div>) : (<div className="w-6 h-6 bg-secondary rounded-full flex items-center justify-center"><Bot className="h-3 w-3 text-secondary-foreground" /></div>)}
                  </div>
                  <div className={`rounded-lg p-2 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown></div>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (<div className="flex justify-start"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /><span>Pensando...</span></div></div>)}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-2 border-t">
        <div className="flex w-full items-center gap-2">
          <Textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder="Pregunta sobre tu nota..." disabled={isLoading} className="flex-1 resize-none min-h-10" rows={1} />
          <Button onClick={handleSendMessage} disabled={isLoading || !userInput.trim()}><Send className="h-4 w-4" /></Button>
        </div>
      </CardFooter>
    </Card>
  );
}