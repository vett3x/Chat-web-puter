"use client";

import { useState, useEffect, useCallback } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserApp {
  id: string;
  name: string;
  status: string;
  url: string | null;
  conversation_id: string | null;
}

interface SelectedItem {
  id: string;
  type: 'app' | 'conversation';
  conversationId: string | null;
}

export default function Home() {
  const { session, isLoading: isSessionLoading, userRole } = useSession();
  const userId = session?.user?.id;

  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [selectedAppDetails, setSelectedAppDetails] = useState<UserApp | null>(null);
  
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

  const handleSelectItem = useCallback(async (id: string | null, type: 'app' | 'conversation' | null) => {
    if (!id || !type) {
      setSelectedItem(null);
      setSelectedAppDetails(null);
      return;
    }

    if (type === 'app') {
      const { data, error } = await supabase
        .from('user_apps')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();
      
      if (error) {
        toast.error('Error al cargar los detalles de la aplicación.');
        return;
      }
      
      setSelectedAppDetails(data);
      setSelectedItem({ id, type, conversationId: data.conversation_id });
    } else {
      setSelectedAppDetails(null);
      setSelectedItem({ id, type, conversationId: id });
    }
  }, [userId]);

  const handleNewConversationCreated = (conversationId: string) => {
    handleSelectItem(conversationId, 'conversation');
  };

  const handleAppCreated = (newApp: UserApp) => {
    // The sidebar will update automatically via its own hook.
    // We just need to select the new app.
    handleSelectItem(newApp.id, 'app');
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

  const renderPanels = () => {
    const sidebar = (
      <ConversationSidebar
        selectedItem={selectedItem}
        onSelectItem={handleSelectItem}
        onOpenProfileSettings={handleOpenProfileSettings}
        onOpenAppSettings={handleOpenAppSettings}
        onOpenServerManagement={handleOpenServerManagement}
        onOpenUserManagement={handleOpenUserManagement}
        onOpenDeepAiCoder={handleOpenDeepAiCoder}
      />
    );

    const chat = (
      <ChatInterface
        userId={userId}
        conversationId={selectedItem?.conversationId || null}
        onNewConversationCreated={handleNewConversationCreated}
        onConversationTitleUpdate={(id, newTitle) => {}}
        aiResponseSpeed={aiResponseSpeed}
      />
    );

    return (
      <div className="flex h-full w-full">
        {/* Sidebar (fixed width) */}
        <div className="w-[320px] flex-shrink-0">
          {sidebar}
        </div>
        
        {/* Main content area (flexible and resizable) */}
        <div className="flex-1 min-w-0">
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={selectedItem?.type === 'app' ? 60 : 100} minSize={30}>
              {chat}
            </ResizablePanel>
            {selectedItem?.type === 'app' && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={40} minSize={20}>
                  <AppPreviewPanel 
                    appUrl={selectedAppDetails?.url || null}
                    appStatus={selectedAppDetails?.status || null}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen bg-background">
      {renderPanels()}

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
        onAppCreated={handleAppCreated}
      />
    </div>
  );
}