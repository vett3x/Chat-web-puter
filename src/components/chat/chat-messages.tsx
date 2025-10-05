"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, User, Loader2, RefreshCw, LayoutDashboard, ClipboardList, Database, Users, BrainCircuit, PenSquare, Lightbulb, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getModelLabel } from '@/lib/ai-models';
import { useUserApiKeys, AiKeyGroup } from '@/hooks/use-user-api-keys'; // Import AiKeyGroup
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
import { Message } from '@/hooks/use-general-chat'; // Corrected import path for Message
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChatMessageItem } from './chat-message-item'; // NEW: Import the memoized component

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
  loadMoreMessages: () => void;
  hasMoreMessages: boolean;
  aiKeyGroups: AiKeyGroup[]; // NEW: Pass aiKeyGroups
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

export function ChatMessages({ messages, isLoading, aiResponseSpeed, onRegenerate, onReapplyFiles, appPrompt, userAvatarUrl, onClearChat, onApprovePlan, isAppChat, onSuggestionClick, loadMoreMessages, hasMoreMessages, aiKeyGroups }: ChatMessagesProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const { userApiKeys } = useUserApiKeys();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);

  useEffect(() => {
    if (shouldScrollToBottom && viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
      setShouldScrollToBottom(false);
    }
  }, [messages, isLoading, shouldScrollToBottom]);

  useEffect(() => {
    // When a new message is added by the user or AI, we want to scroll to the bottom.
    if (messages.length > 0 && messages[messages.length - 1].isNew) {
      setShouldScrollToBottom(true);
    }
  }, [messages]);

  const handleScroll = useCallback(async (e: Event) => {
    const target = e.currentTarget as HTMLDivElement;
    const { scrollTop } = target;
    if (scrollTop === 0 && hasMoreMessages && !isLoadingMore) {
      setIsLoadingMore(true);
      const currentScrollHeight = target.scrollHeight;
      await loadMoreMessages();
      // After loading, adjust scroll to keep the view stable
      if (viewportRef.current) {
        viewportRef.current.scrollTop = viewportRef.current.scrollHeight - currentScrollHeight;
      }
      setIsLoadingMore(false);
    }
  }, [hasMoreMessages, isLoadingMore, loadMoreMessages]);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewportRef.current = viewport as HTMLDivElement;
      viewport.addEventListener('scroll', handleScroll);
      return () => {
        viewport.removeEventListener('scroll', handleScroll);
      };
    }
  }, [handleScroll]);

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
  const displayedMessages = messages;

  return (
    <ScrollArea className="h-full" ref={scrollAreaRef}>
      <div className="p-4 space-y-4 pb-32">
        {isLoadingMore && (
          <div className="flex justify-center py-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
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
          displayedMessages.map((message: Message, index: number) => {
            if (typeof message.content === 'string' && 
                (message.content.endsWith('[USER_APPROVED_PLAN]') || 
                 message.content.endsWith('[USER_REQUESTED_BUILD_FIX]') || 
                 message.content.endsWith('[USER_REPORTED_WEB_ERROR]') ||
                 message.content.endsWith('[USER_APPROVED_CORRECTION_PLAN]'))) {
              return null;
            }

            const isLastMessage = index === displayedMessages.length - 1;

            return (
              <ChatMessageItem
                key={message.id}
                message={message}
                isLastMessage={isLastMessage}
                userAvatarUrl={userAvatarUrl}
                aiResponseSpeed={aiResponseSpeed}
                onRegenerate={onRegenerate}
                onReapplyFiles={onReapplyFiles}
                onApprovePlan={onApprovePlan}
                isAppChat={isAppChat}
                isLoading={isLoading}
                userApiKeys={userApiKeys}
                aiKeyGroups={aiKeyGroups} // NEW: Pass aiKeyGroups
              />
            );
          })
        )}
      </div>
    </ScrollArea>
  );
}