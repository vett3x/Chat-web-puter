"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { useGeneralChat } from './use-general-chat';
import { useDeepAICoderChat } from './use-deepai-coder-chat';
import { useNoteAssistantChat } from './use-note-assistant-chat';
import { ApiKey, AiKeyGroup } from './use-user-api-keys';
import { Message, AutoFixStatus } from './use-general-chat';
import { RenderablePart } from '@/lib/utils';

export type { Message, AutoFixStatus, RenderablePart };

interface UseChatProps {
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
  aiKeyGroups: AiKeyGroup[];
  isLoadingApiKeys: boolean;
  chatMode: 'build' | 'chat';
  noteId?: string;
  noteTitle?: string;
  noteContent?: string;
  initialNoteChatHistory?: Message[];
  onSaveNoteChatHistory?: (history: Message[]) => void;
  userDefaultModel: string | null; // New prop
}

export function useChat({
  userId,
  conversationId,
  onNewConversationCreated,
  onConversationTitleUpdate,
  aiResponseSpeed,
  appPrompt,
  appId,
  onWriteFiles,
  isAppChat,
  onSidebarDataRefresh,
  userApiKeys,
  aiKeyGroups,
  isLoadingApiKeys,
  chatMode,
  noteId,
  noteTitle,
  noteContent,
  initialNoteChatHistory,
  onSaveNoteChatHistory,
  userDefaultModel, // New prop
}: UseChatProps) {
  const isDeepAICoderActive = isAppChat && appId && appPrompt;
  const isNoteAssistantActive = !!noteId && !!noteTitle && !!noteContent && !!onSaveNoteChatHistory;

  const generalChat = useGeneralChat({
    userId,
    conversationId,
    onNewConversationCreated,
    onConversationTitleUpdate,
    onSidebarDataRefresh,
    userApiKeys,
    aiKeyGroups,
    isLoadingApiKeys,
    userDefaultModel, // Pass prop
  });

  const deepAICoderChat = useDeepAICoderChat({
    userId,
    conversationId,
    onNewConversationCreated,
    onConversationTitleUpdate,
    appPrompt: appPrompt || '',
    appId: appId || '',
    onWriteFiles,
    onSidebarDataRefresh,
    userApiKeys,
    aiKeyGroups,
    isLoadingApiKeys,
    chatMode,
    isAppChat,
    userDefaultModel, // Pass prop
  });

  if (isDeepAICoderActive) {
    return deepAICoderChat;
  } else {
    return generalChat;
  }
}