"use client";

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useChat } from '@/hooks/use-chat';
import { ChatMessages } from '@/components/chat/chat-messages';
import { ChatInput } from '@/components/chat/chat-input';

interface ChatInterfaceProps {
  userId: string | undefined;
  conversationId: string | null;
  onNewConversationCreated: (conversationId: string) => void;
  onConversationTitleUpdate: (conversationId: string, newTitle: string) => void;
  aiResponseSpeed: 'slow' | 'normal' | 'fast';
  isAppProvisioning?: boolean;
  isAppDeleting?: boolean;
  appPrompt?: string | null;
  appId?: string | null;
  onFilesWritten?: () => void;
}

export function ChatInterface({
  userId,
  conversationId,
  onNewConversationCreated,
  onConversationTitleUpdate,
  aiResponseSpeed,
  isAppProvisioning = false,
  isAppDeleting = false,
  appPrompt,
  appId,
  onFilesWritten,
}: ChatInterfaceProps) {
  const {
    messages,
    isLoading,
    isPuterReady,
    selectedModel,
    handleModelChange,
    sendMessage,
    regenerateLastResponse,
  } = useChat({
    userId,
    conversationId,
    onNewConversationCreated,
    onConversationTitleUpdate,
    appPrompt,
    appId,
    onFilesWritten,
  });

  if (isAppProvisioning) {
    return (
      <div className="flex flex-col h-full bg-background items-center justify-center text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <h3 className="text-lg font-semibold">Aprovisionando el entorno...</h3>
        <p className="text-muted-foreground">El chat estará disponible cuando el proyecto esté listo.</p>
      </div>
    );
  }

  if (isAppDeleting) {
    return (
      <div className="flex flex-col h-full bg-background items-center justify-center text-center">
        <Loader2 className="h-8 w-8 animate-spin text-destructive mb-4" />
        <h3 className="text-lg font-semibold">Eliminando proyecto...</h3>
        <p className="text-muted-foreground">El chat se desactivará mientras se eliminan los recursos.</p>
      </div>
    );
  }

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
        <ChatMessages
          messages={messages}
          isLoading={isLoading}
          aiResponseSpeed={aiResponseSpeed}
          onRegenerate={regenerateLastResponse}
          appPrompt={appPrompt}
        />
        <ChatInput
          isLoading={isLoading}
          selectedModel={selectedModel}
          onModelChange={handleModelChange}
          sendMessage={sendMessage}
        />
      </div>
    </div>
  );
}