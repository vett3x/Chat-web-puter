"use client";

import { ChatInterface } from "@/components/chat-interface";
import { ConversationSidebar } from "@/components/conversation-sidebar";
import { useSession } from "@/components/session-context-provider";
import { useState, useEffect } from "react";
import { ProfileSettingsDialog } from "@/components/profile-settings-dialog";
import { AppSettingsDialog } from "@/components/app-settings-dialog";
import { ServerManagementDialog } from "@/components/server-management-dialog";
import { UserManagementDialog } from "@/components/user-management-dialog";
import { DeepAiCoderDialog } from "@/components/deep-ai-coder-dialog"; // Import the new dialog

export default function Home() {
  const { session, isLoading: isSessionLoading, userRole } = useSession();
  const userId = session?.user?.id;
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const [isAppSettingsOpen, setIsAppSettingsOpen] = useState(false);
  const [isServerManagementOpen, setIsServerManagementOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isDeepAiCoderOpen, setIsDeepAiCoderOpen] = useState(false); // State for the new dialog
  const [aiResponseSpeed, setAiResponseSpeed] = useState<'slow' | 'normal' | 'fast'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('aiResponseSpeed') as 'slow' | 'normal' | 'fast') || 'normal';
    }
    return 'normal';
  });

  useEffect(() => {
    if (userId && !isSessionLoading) {
      // Logic for conversation handling
    }
  }, [userId, isSessionLoading]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aiResponseSpeed', aiResponseSpeed);
    }
  }, [aiResponseSpeed]);

  const handleNewConversationCreated = (conversationId: string) => {
    setSelectedConversationId(conversationId);
  };

  const handleOpenProfileSettings = () => setIsProfileSettingsOpen(true);
  const handleOpenAppSettings = () => setIsAppSettingsOpen(true);
  const handleOpenServerManagement = () => setIsServerManagementOpen(true);
  const handleOpenUserManagement = () => setIsUserManagementOpen(true);
  const handleOpenDeepAiCoder = () => setIsDeepAiCoderOpen(true); // Handler for the new dialog

  const handleAiResponseSpeedChange = (speed: 'slow' | 'normal' | 'fast') => {
    setAiResponseSpeed(speed);
  };

  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-[300px] flex-shrink-0">
        <ConversationSidebar
          selectedConversationId={selectedConversationId}
          onSelectConversation={setSelectedConversationId}
          onOpenProfileSettings={handleOpenProfileSettings}
          onOpenAppSettings={handleOpenAppSettings}
          onOpenServerManagement={handleOpenServerManagement}
          onOpenUserManagement={handleOpenUserManagement}
          onOpenDeepAiCoder={handleOpenDeepAiCoder} // Pass the new handler
        />
      </aside>
      <main className="flex-1 flex flex-col min-w-0">
        <ChatInterface
          userId={userId}
          conversationId={selectedConversationId}
          onNewConversationCreated={handleNewConversationCreated}
          onConversationTitleUpdate={(id, newTitle) => {
            // This prop will be used to update the title in the sidebar if the chat interface changes it
          }}
          aiResponseSpeed={aiResponseSpeed}
        />
        <ProfileSettingsDialog
          open={isProfileSettingsOpen}
          onOpenChange={setIsProfileSettingsOpen}
        />
        <AppSettingsDialog
          open={isAppSettingsOpen}
          onOpenChange={setIsAppSettingsOpen}
          aiResponseSpeed={aiResponseSpeed}
          onAiResponseSpeedChange={handleAiResponseSpeedChange}
        />
        {isAdmin && (
          <ServerManagementDialog
            open={isServerManagementOpen}
            onOpenChange={setIsServerManagementOpen}
          />
        )}
        {isAdmin && (
          <UserManagementDialog
            open={isUserManagementOpen}
            onOpenChange={setIsUserManagementOpen}
          />
        )}
        <DeepAiCoderDialog
          open={isDeepAiCoderOpen}
          onOpenChange={setIsDeepAiCoderOpen}
        />
      </main>
    </div>
  );
}