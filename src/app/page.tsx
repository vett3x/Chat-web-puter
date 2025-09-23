"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/components/session-context-provider";
import { ConversationSidebar } from "@/components/conversation-sidebar";
import { ChatInterface } from "@/components/chat-interface";
import { AppPreviewPanel } from "@/components/app-preview-panel";
import { ProfileSettingsDialog } from "@/components/profile-settings-dialog";
import { AppSettingsDialog } from "@/components/app-settings-dialog";
import { ServerManagementDialog } from "@/components/server-management-dialog";
import { UserManagementDialog } from "@/components/user-management-dialog";
import { DeepAiCoderDialog } from "@/components/deep-ai-coder-dialog";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

// Definir el tipo para una aplicación de usuario
interface UserApp {
  id: string;
  name: string;
  status: string;
  url: string | null;
  conversation_id: string | null;
}

export default function Home() {
  const { session, isLoading: isSessionLoading, userRole } = useSession();
  const userId = session?.user?.id;

  // Estado para la aplicación seleccionada
  const [selectedApp, setSelectedApp] = useState<UserApp | null>(null);
  
  // Estados para los diálogos
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const [isAppSettingsOpen, setIsAppSettingsOpen] = useState(false);
  const [isServerManagementOpen, setIsServerManagementOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isDeepAiCoderOpen, setIsDeepAiCoderOpen] = useState(false);
  
  const [aiResponseSpeed, setAiResponseSpeed] = useState<'slow' | 'normal' | 'fast'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('aiResponseSpeed') as 'slow' | 'normal' | 'fast') || 'normal';
    }
    return 'normal';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aiResponseSpeed', aiResponseSpeed);
    }
  }, [aiResponseSpeed]);

  const handleNewConversationCreated = (conversationId: string) => {
    // This might need adjustment based on the new app flow
  };

  const handleOpenProfileSettings = () => setIsProfileSettingsOpen(true);
  const handleOpenAppSettings = () => setIsAppSettingsOpen(true);
  const handleOpenServerManagement = () => setIsServerManagementOpen(true);
  const handleOpenUserManagement = () => setIsUserManagementOpen(true);
  const handleOpenDeepAiCoder = () => setIsDeepAiCoderOpen(true);

  const handleAiResponseSpeedChange = (speed: 'slow' | 'normal' | 'fast') => {
    setAiResponseSpeed(speed);
  };

  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  return (
    <div className="h-screen bg-background">
      <ResizablePanelGroup direction="horizontal" className="h-full w-full">
        <ResizablePanel defaultSize={20} minSize={15} maxSize={25}>
          <ConversationSidebar
            selectedConversationId={selectedApp?.conversation_id || null}
            onSelectConversation={(convId) => { /* Logic to find app by convId */ }}
            onOpenProfileSettings={handleOpenProfileSettings}
            onOpenAppSettings={handleOpenAppSettings}
            onOpenServerManagement={handleOpenServerManagement}
            onOpenUserManagement={handleOpenUserManagement}
            onOpenDeepAiCoder={handleOpenDeepAiCoder}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50} minSize={30}>
          <ChatInterface
            userId={userId}
            conversationId={selectedApp?.conversation_id || null}
            onNewConversationCreated={handleNewConversationCreated}
            onConversationTitleUpdate={(id, newTitle) => {}}
            aiResponseSpeed={aiResponseSpeed}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={30} minSize={20}>
          <AppPreviewPanel 
            appUrl={selectedApp?.url || null}
            appStatus={selectedApp?.status || null}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Dialogs */}
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
    </div>
  );
}