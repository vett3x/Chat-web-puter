"use client";

import { ChatInterface } from "@/components/chat-interface";
import { Toaster } from "@/components/ui/sonner";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ConversationSidebar } from "@/components/conversation-sidebar";
import { useSession } from "@/components/session-context-provider";
import { useState, useEffect } from "react";


export default function Home() {
  const { session, isLoading: isSessionLoading } = useSession();
  const userId = session?.user?.id;
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col h-screen">
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={25} minSize={20} maxSize={30}>
          <ConversationSidebar
            selectedConversationId={selectedConversationId}
            onSelectConversation={setSelectedConversationId}
            onNewConversationCreated={handleNewConversationCreated}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={75}>
          <ChatInterface
            userId={userId}
            conversationId={selectedConversationId}
            onNewConversationCreated={handleNewConversationCreated}
            onConversationTitleUpdate={(id, newTitle) => {
              // This prop will be used to update the title in the sidebar if the chat interface changes it
              // For now, the sidebar manages its own titles.
            }}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
      <Toaster />
    </div>
  );
}