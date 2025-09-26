"use client";

import React, { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, User, Loader2, Clipboard, RefreshCw, Upload, Trash2, LayoutDashboard, ClipboardList, Database, Users, BrainCircuit, PenSquare, Lightbulb, Bug } from 'lucide-react';
import { MessageContent } from '@/components/message-content';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getModelLabel } from '@/lib/ai-models';
import { useUserApiKeys } from '@/hooks/use-user-api-keys';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { ConstructionPlan } from './construction-plan';
import { Message } from '@/hooks/use-chat';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  aiResponseSpeed: 'slow' | 'normal' | 'fast';
  onRegenerate: () => void;
  onReapplyFiles: (message: Message) => void;
  appPrompt?: string | null;
  userAvatarUrl: string | null;
  onClearChat: () => void;
  onApprovePlan: (messageId: string) => void;
  isAppChat?: boolean;
  onSuggestionClick: (prompt: string) => void;
}

const SuggestionCard = ({ icon, title, description, onClick }: { icon: React.ReactNode, title: string, description: string, onClick: () => void }) => (
  <Card onClick={onClick} className="cursor-pointer hover:bg-accent transition-colors">
    <CardHeader className="flex flex-row items-start gap-4 space-y-0 p-4">
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </div>
    </CardHeader>
  </Card>
);

export function ChatMessages({ messages, isLoading, aiResponseSpeed, onRegenerate, onReapplyFiles, appPrompt, userAvatarUrl, onClearChat, onApprovePlan, isAppChat, onSuggestionClick }: ChatMessagesProps) {
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

  const handleCopy = (content: Message['content']) => {
    let textToCopy = '';
    if (typeof content === 'string') {
      textToCopy = content;
    } else if (Array.isArray(content)) {
      textToCopy = content.map(part => (part.type === 'text' ? part.text : '')).join('\n');
    }
    navigator.clipboard.writeText(textToCopy);
    toast.success('Copiado al portapapeles.');
  };

  const handleRequestChanges = () => {
    toast.info("Plan rechazado. Por favor, escribe tus cambios en el chat para que la IA genere un nuevo plan.");
  };

  const appSuggestions = [
    { icon: <LayoutDashboard className="h-5 w-5 text-blue-400" />, title: "Crear la página de inicio", description: "Diseña el layout principal de la aplicación.", prompt: "Crea la página de inicio con una barra de navegación, un área de contenido principal y un pie de página." },
    { icon: <ClipboardList className="h-5 w-5 text-orange-400" />, title: "Añadir un formulario", description: "Implementa un formulario de contacto o registro.", prompt: "Añade un formulario de contacto con campos para nombre, email y mensaje." },
    { icon: <Database className="h-5 w-5 text-green-400" />, title: "Configurar la base de datos", description: "Define el esquema y la conexión a la base de datos.", prompt: "Configura el esquema de la base de datos para una tabla de 'usuarios' con campos para id, nombre y email." },
    { icon: <Users className="h-5 w-5 text-purple-400" />, title: "Implementar la autenticación", description: "Añade un sistema de inicio de sesión y registro.", prompt: "Implementa la autenticación de usuarios con email y contraseña." },
  ];

  const generalSuggestions = [
    { icon: <BrainCircuit className="h-5 w-5 text-blue-400" />, title: "Explícame un concepto", description: "Pide una explicación simple de un tema complejo.", prompt: "Explícame la computación cuántica como si tuviera cinco años." },
    { icon: <PenSquare className="h-5 w-5 text-orange-400" />, title: "Escribe un poema", description: "Genera un poema sobre cualquier tema que imagines.", prompt: "Escribe un poema sobre el código y la creatividad." },
    { icon: <Lightbulb className="h-5 w-5 text-green-400" />, title: "Dame ideas para un proyecto", description: "Obtén ideas innovadoras para tu próximo proyecto.", prompt: "Dame tres ideas para una aplicación de viajes que use IA." },
    { icon: <Bug className="h-5 w-5 text-purple-400" />, title: "Ayúdame a depurar código", description: "Pega tu código y obtén ayuda para encontrar errores.", prompt: "Ayúdame a depurar este código de JavaScript que no funciona como espero:" },
  ];

  const suggestions = isAppChat ? appSuggestions : generalSuggestions;

  return (
    <ScrollArea className="h-full" ref={scrollAreaRef}>
      <div className="p-4 space-y-4 pb-48">
        {messages.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-8 max-w-2xl mx-auto">
            <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
            {appPrompt ? (
              <>
                <h2 className="text-2xl font-semibold text-foreground">¡Todo listo para empezar a construir!</h2>
                <p className="mt-2">Tu proyecto es: <span className="font-medium text-primary">"{appPrompt}"</span></p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-semibold text-foreground">Hola, soy tu Asistente de IA</h2>
                <p className="mt-2">¿Cómo puedo ayudarte hoy?</p>
              </>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 text-left w-full">
              {suggestions.map((s: { icon: React.ReactNode, title: string, description: string, prompt: string }, i: number) => (
                <SuggestionCard key={i} {...s} onClick={() => onSuggestionClick(s.prompt)} />
              ))}
            </div>
          </div>
        ) : (
          messages.map((message: Message, index: number) => {
            // Skip rendering the hidden approval message
            if (message.content === '[USER_APPROVED_PLAN]' || message.content === '[USER_REQUESTED_BUILD_FIX]' || message.content === '[USER_REPORTED_WEB_ERROR]') {
              return null;
            }

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
                      <Avatar className="w-8 h-8 shadow-avatar-user">
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
                        <Bot className="h-4 w-4" />
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
                      <MessageContent
                        content={message.content}
                        isNew={isLastMessage && !message.isAnimated} // Only pass isNew if it's the last message and not yet animated
                        aiResponseSpeed={aiResponseSpeed}
                        isAppChat={isAppChat}
                        isConstructionPlan={message.isConstructionPlan} // Pass isConstructionPlan
                        planApproved={message.planApproved} // Pass planApproved
                        onApprovePlan={onApprovePlan} // Pass onApprovePlan
                        onRequestChanges={handleRequestChanges} // Pass onRequestChanges
                        messageId={message.id} // Pass messageId
                        onAnimationComplete={() => {
                          // Mark message as animated once its content animation is complete
                          if (isLastMessage && !message.isAnimated) {
                            // This will trigger a re-render, but isAnimated will prevent re-animation
                            // For now, we only update the local state. Persistence to DB can be added later if needed.
                            // setMessages(prev => prev.map(m => m.id === message.id ? { ...m, isAnimated: true } : m));
                          }
                        }}
                      />
                    )}
                  </div>
                  {message.role === 'assistant' && !message.isTyping && !message.isConstructionPlan && (
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