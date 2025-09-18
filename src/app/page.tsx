"use client";

import { ChatInterface } from "@/components/chat-interface";
import { ConversationSidebar } from "@/components/conversation-sidebar";
import { useSession } from "@/components/session-context-provider";
import { useState, useEffect } from "react";
import { ProfileSettingsDialog } from "@/components/profile-settings-dialog"; // Import the new dialog component

export default function Home() {
  const { session, isLoading: isSessionLoading } = useSession();
  const userId = session?.user?.id;
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false); // State for dialog visibility

  // When user logs in, if there are no conversations, create a new one automatically
  useEffect(() => {
    if (userId && !isSessionLoading) {
      // This logic will be handled by ConversationSidebar's initial fetch and create if empty
      // For now, we just ensure a conversation can be selected or created.
    }
  }, [userId, isSessionLoading]);

  const handleNewConversationCreated = (conversationId: string) => {
    setSelectedConversationId(conversationId);
  };

  const handleOpenProfileSettings = () => {
    setIsProfileSettingsOpen(true);
  };

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-[300px] flex-shrink-0">
        <ConversationSidebar
          selectedConversationId={selectedConversationId}
          onSelectConversation={setSelectedConversationId}
          onOpenProfileSettings={handleOpenProfileSettings} // Pass the function to open the dialog
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
        />
        {/* Render the ProfileSettingsDialog here */}
        <ProfileSettingsDialog
          open={isProfileSettingsOpen}
          onOpenChange={setIsProfileSettingsOpen}
        />
      </main>
    </div>
  );
}