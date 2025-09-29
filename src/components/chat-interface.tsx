"use client";

import React, { useState, useImperativeHandle, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useChat } from '@/hooks/use-chat'; // Import useChat dispatcher
import { AutoFixStatus, Message } from '@/hooks/use-general-chat'; // Import types from use-general-chat
import { ChatMessages } from '@/components/chat/chat-messages';
import { ChatInput, ChatMode } from '@/components/chat/chat-input';
import { ApiKey } from '@/hooks/use-user-api-keys';
import { useSession } from './session-context-provider';
import { AutoFixStatus as AutoFixStatusComponent } from './chat/auto-fix-status';

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
  userApiKeys: ApiKey[];
  isLoadingApiKeys: boolean;
}

export interface ChatInterfaceRef {
  autoFixStatus: AutoFixStatus;
  triggerFixBuildError: () => void;
  triggerReportWebError: () => void;
  refreshChatMessages: () => void; // NEW: Expose refreshChatMessages
}

export const ChatInterface = forwardRef<ChatInterfaceRef, ChatInterfaceProps>(({
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
  userApiKeys,
  isLoadingApiKeys,
}, ref) => {
  const { userAvatarUrl } = useSession();
  const [chatMode, setChatMode] = useState<ChatMode>('build');

  const {
    messages,
    isLoading,
    isPuterReady,
    selectedModel,
    handleModelChange,
    sendMessage,
    regenerateLastResponse,
    reapplyFilesFromMessage,
    clearChat,
    approvePlan,
    autoFixStatus,
    triggerFixBuildError,
    triggerReportWebError,
    loadConversationData, // NEW: Get loadConversationData from useChat
  } = useChat({
    userId,
    conversationId,
    onNewConversationCreated,
    onConversationTitleUpdate,
    aiResponseSpeed, // Pass aiResponseSpeed
    appPrompt,
    appId,
    onWriteFiles,
    onSidebarDataRefresh,
    userApiKeys,
    isLoadingApiKeys,
    chatMode,
    isAppChat,
  });

  // Expose autoFixStatus and trigger functions via ref
  useImperativeHandle(ref, () => ({
    autoFixStatus,
    triggerFixBuildError,
    triggerReportWebError,
    refreshChatMessages: loadConversationData, // NEW: Expose loadConversationData as refreshChatMessages
  }));

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

  if (!userId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-muted-foreground">Por favor, inicia sesión para chatear.</p>
        </div>
      </div>
    );
  }

  // Show the UI immediately but disable input while keys/puter are loading
  const isChatReady = isPuterReady && !isLoadingApiKeys;

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
          userAvatarUrl={userAvatarUrl}
          onClearChat={clearChat}
          onApprovePlan={approvePlan}
          isAppChat={isAppChat}
          onSuggestionClick={(prompt: string) => sendMessage([{ type: 'text', text: prompt }], prompt)}
        />
        <AutoFixStatusComponent status={autoFixStatus} />
        <ChatInput
          isLoading={isLoading || !isChatReady} // Disable if AI is thinking OR if keys/puter are not ready
          selectedModel={selectedModel}
          onModelChange={handleModelChange}
          sendMessage={sendMessage}
          isAppChat={isAppChat}
          onClearChat={clearChat}
          chatMode={chatMode}
          onChatModeChange={setChatMode}
        />
      </div>
    </div>
  );
});

ChatInterface.displayName = 'ChatInterface';