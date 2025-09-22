"use client";

import { ChatInterface } from "@/components/chat-interface";
import { ConversationSidebar } from "@/components/conversation-sidebar";
import { useSession } from "@/components/session-context-provider";
import { useState, useEffect } from "react";
import { ProfileSettingsDialog } from "@/components/profile-settings-dialog";
import { AppSettingsDialog } from "@/components/app-settings-dialog";
import { ServerManagementDialog } from "@/components/server-management-dialog";
import { UserManagementDialog } from "@/components/user-management-dialog"; // Import the new dialog

export default function Home() {
  const { session, isLoading: isSessionLoading, userRole } = useSession(); // Changed isSuperUser to userRole
  const userId = session?.user?.id;
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const [isAppSettingsOpen, setIsAppSettingsOpen] = useState(false);
  const [isServerManagementOpen, setIsServerManagementOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false); // State for UserManagementDialog visibility
  const [aiResponseSpeed, setAiResponseSpeed] = useState<'slow' | 'normal' | 'fast'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('aiResponseSpeed') as 'slow' | 'normal' | 'fast') || 'normal';
    }
    return 'normal';
  });

  // When user logs in, if there are no conversations, create a new one automatically
  useEffect(() => {
    if (userId && !isSessionLoading) {
      // This logic will be handled by ConversationSidebar's initial fetch and create if empty
      // For now, we just ensure a conversation can be selected or created.
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

  const handleOpenProfileSettings = () => {
    setIsProfileSettingsOpen(true);
  };

  const handleOpenAppSettings = () => {
    setIsAppSettingsOpen(true);
  };

  const handleOpenServerManagement = () => {
    setIsServerManagementOpen(true);
  };

  const handleOpenUserManagement = () => { // New handler for user management
    setIsUserManagementOpen(true);
  };

  const handleAiResponseSpeedChange = (speed: 'slow' | 'normal' | 'fast') => {
    setAiResponseSpeed(speed);
    // Optionally, close the dialog after changing speed
    // setIsAppSettingsOpen(false);
  };

  const isSuperAdmin = userRole === 'super_admin'; // Helper for conditional rendering

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-[300px] flex-shrink-0">
        <ConversationSidebar
          selectedConversationId={selectedConversationId}
          onSelectConversation={setSelectedConversationId}
          onOpenProfileSettings={handleOpenProfileSettings}
          onOpenAppSettings={handleOpenAppSettings}
          onOpenServerManagement={handleOpenServerManagement}
          onOpenUserManagement={handleOpenUserManagement} // Pass the new function
        />
      </aside>
      <main className="flex-1 flex flex-col min-w-0">
        <ChatInterface
          userId={userId}
          conversationId={selectedConversationId}
          onNewConversationCreated={handleNewConversationCreated}
          onConversationTitleUpdate={(id, newTitle) => {
            // This prop will be used to update the title in the sidebar if the chat interface changes it
            // For now, the sidebar manages its own titles.
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
        {isSuperAdmin && ( // Render ServerManagementDialog and UserManagementDialog conditionally based on isSuperAdmin
          <>
            <ServerManagementDialog
              open={isServerManagementOpen}
              onOpenChange={setIsServerManagementOpen}
            />
            <UserManagementDialog
              open={isUserManagementOpen}
              onOpenChange={setIsUserManagementOpen}
            />
          </>
        )}
      </main>
    </div>
  );
}