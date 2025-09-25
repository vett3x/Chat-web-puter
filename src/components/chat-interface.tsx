"use client";

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useChat } from '@/hooks/use-chat';
import { ChatMessages } from '@/components/chat/chat-messages';
import { ChatInput } from '@/components/chat/chat-input';
import { ApiKey } from '@/hooks/use-user-api-keys'; // NEW: Import ApiKey type

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
  onWriteFiles: (files: { path: string; content: string }[]) => Promise<void>;
  isAppChat?: boolean;
  onSidebarDataRefresh: () => void;
  userApiKeys: ApiKey[]; // NEW: Prop for user API keys
  isLoadingApiKeys: boolean; // NEW: Prop for loading state of API keys
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
  onWriteFiles,
  isAppChat = false,
  onSidebarDataRefresh,
  userApiKeys, // NEW: Destructure
  isLoadingApiKeys, // NEW: Destructure
}: ChatInterfaceProps) {
  const {
    messages,
    isLoading,
    isPuterReady,
    selectedModel,
    handleModelChange,
    sendMessage,
    regenerateLastResponse,
    reapplyFilesFromMessage,
  } = useChat({
    userId,
    conversationId,
    onNewConversationCreated,
    onConversationTitleUpdate,
    appPrompt,
    appId,
    onWriteFiles,
    onSidebarDataRefresh,
    userApiKeys, // NEW: Pass to useChat
    isLoadingApiKeys, // NEW: Pass to useChat
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

  if (!isPuterReady || isLoadingApiKeys) { // NEW: Check isLoadingApiKeys
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando IA y claves...</p> {/* NEW: Updated message */}
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
          onReapplyFiles={reapplyFilesFromMessage}
          appPrompt={appPrompt}
        />
        <ChatInput
          isLoading={isLoading}
          selectedModel={selectedModel}
          onModelChange={handleModelChange}
          sendMessage={sendMessage}
          isAppChat={isAppChat}
        />
      </div>
    </div>
  );
}