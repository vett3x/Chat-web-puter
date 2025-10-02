"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { useGeneralChat } from './use-general-chat';
import { useDeepAICoderChat } from './use-deepai-coder-chat';
import { useNoteAssistantChat } from './use-note-assistant-chat'; // Not directly used here, but for context
import { ApiKey, AiKeyGroup } from './use-user-api-keys'; // NEW: Import AiKeyGroup
import { Message, AutoFixStatus } from './use-general-chat'; // Re-export types from general chat
import { RenderablePart } from '@/lib/utils'; // Import RenderablePart directly

export type { Message, AutoFixStatus, RenderablePart }; // Explicitly re-export Message, AutoFixStatus, and RenderablePart

interface UseChatProps {
  userId: string | undefined;
  conversationId: string | null;
  onNewConversationCreated: (conversationId: string) => void;
  onConversationTitleUpdate: (conversationId: string, newTitle: string) => void;
  aiResponseSpeed: 'slow' | 'normal' | 'fast'; // Not passed to sub-hooks, managed by UI
  isAppProvisioning?: boolean; // Not passed to sub-hooks, managed by UI
  isAppDeleting?: boolean; // Not passed to sub-hooks, managed by UI
  appPrompt?: string | null;
  appId?: string | null;
  onWriteFiles: (files: { path: string; content: string }[]) => Promise<void>;
  isAppChat?: boolean;
  onSidebarDataRefresh: () => void;
  userApiKeys: ApiKey[];
  aiKeyGroups: AiKeyGroup[]; // NEW: Pass aiKeyGroups
  isLoadingApiKeys: boolean;
  chatMode: 'build' | 'chat';
  noteId?: string; // For note assistant context
  noteTitle?: string; // For note assistant context
  noteContent?: string; // For note assistant context
  initialNoteChatHistory?: Message[]; // For note assistant context
  onSaveNoteChatHistory?: (history: Message[]) => void; // For note assistant context
}

export function useChat({
  userId,
  conversationId,
  onNewConversationCreated,
  onConversationTitleUpdate,
  aiResponseSpeed, // Destructure aiResponseSpeed
  appPrompt,
  appId,
  onWriteFiles,
  isAppChat,
  onSidebarDataRefresh,
  userApiKeys,
  aiKeyGroups, // NEW: Destructure aiKeyGroups
  isLoadingApiKeys,
  chatMode,
  noteId,
  noteTitle,
  noteContent,
  initialNoteChatHistory,
  onSaveNoteChatHistory,
}: UseChatProps) {
  // Determine which chat context is active
  const isDeepAICoderActive = isAppChat && appId && appPrompt;
  const isNoteAssistantActive = !!noteId && !!noteTitle && !!noteContent && !!onSaveNoteChatHistory;

  // Use the appropriate specialized hook
  const generalChat = useGeneralChat({
    userId,
    conversationId,
    onNewConversationCreated,
    onConversationTitleUpdate,
    onSidebarDataRefresh,
    userApiKeys,
    aiKeyGroups, // NEW: Pass aiKeyGroups
    isLoadingApiKeys,
  });

  const deepAICoderChat = useDeepAICoderChat({
    userId,
    conversationId,
    onNewConversationCreated,
    onConversationTitleUpdate,
    appPrompt: appPrompt || '', // Ensure it's a string
    appId: appId || '', // Ensure it's a string
    onWriteFiles,
    onSidebarDataRefresh,
    userApiKeys,
    aiKeyGroups, // NEW: Pass aiKeyGroups
    isLoadingApiKeys,
    chatMode,
    isAppChat,
  });

  // The NoteAssistantChat hook is used directly within NoteAiChat component,
  // so we don't call it here. This `useChat` hook is for the main chat interface.

  if (isDeepAICoderActive) {
    return deepAICoderChat;
  } else {
    return generalChat;
  }
}