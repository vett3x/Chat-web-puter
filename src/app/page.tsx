"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/components/session-context-provider";
import { ConversationSidebar } from "@/components/conversation-sidebar";
import { ChatInterface } from "@/components/chat-interface";
import { AppBrowserPanel } from "@/components/app-browser-panel";
import { CodeEditorPanel } from "@/components/code-editor-panel";
import { NoteEditorPanel } from "@/components/note-editor-panel";
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
import { Loader2 } from "lucide-react";
import { useSidebarData } from "@/hooks/use-sidebar-data";

interface UserApp {
  id: string;
  name: string;
  status: string;
  url: string | null;
  conversation_id: string | null;
}

interface SelectedItem {
  id: string;
  type: 'app' | 'conversation' | 'note' | 'folder';
  conversationId?: string | null;
}

interface ActiveFile {
  path: string;
  content: string;
}

type RightPanelView = 'editor' | 'preview';

export default function Home() {
  const { session, isLoading: isSessionLoading, userRole } = useSession();
  const userId = session?.user?.id;
  const { fetchData: refreshSidebarData } = useSidebarData();

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

  const [rightPanelView, setRightPanelView] = useState<RightPanelView>('preview');
  const [activeFile, setActiveFile] = useState<ActiveFile | null>(null);
  const [isFileLoading, setIsFileLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aiResponseSpeed', aiResponseSpeed);
    }
  }, [aiResponseSpeed]);

  useEffect(() => {
    if (selectedAppDetails?.status === 'provisioning' && selectedAppDetails.id) {
      const channel = supabase
        .channel(`app-status-updates-${selectedAppDetails.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_apps',
            filter: `id=eq.${selectedAppDetails.id}`,
          },
          (payload) => {
            const updatedApp = payload.new as UserApp;
            setSelectedAppDetails(updatedApp);
            if (updatedApp.status !== 'provisioning') {
              toast.success(`La aplicación "${updatedApp.name}" está lista.`);
              supabase.removeChannel(channel);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedAppDetails]);

  const handleSelectItem = useCallback(async (id: string | null, type: SelectedItem['type'] | null) => {
    setActiveFile(null);
    setRightPanelView('preview');

    if (!id || !type) {
      setSelectedItem(null);
      setSelectedAppDetails(null);
      return;
    }

    if (type === 'app') {
      const { data, error } = await supabase.from('user_apps').select('*').eq('id', id).eq('user_id', userId).single();
      if (error) {
        toast.error('Error al cargar los detalles de la aplicación.');
        return;
      }
      setSelectedAppDetails(data);
      setSelectedItem({ id, type, conversationId: data.conversation_id });
    } else {
      setSelectedAppDetails(null);
      setSelectedItem({ id, type, conversationId: type === 'conversation' ? id : null });
    }
  }, [userId]);

  const handleFileSelect = async (path: string) => {
    if (!selectedItem || selectedItem.type !== 'app') return;
    setIsFileLoading(true);
    try {
      const response = await fetch(`/api/apps/${selectedItem.id}/file?path=${encodeURIComponent(path)}`);
      if (!response.ok) throw new Error('No se pudo cargar el contenido del archivo.');
      const data = await response.json();
      setActiveFile({ path, content: data.content });
      setRightPanelView('editor');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsFileLoading(false);
    }
  };

  const handleNewConversationCreated = (conversationId: string) => {
    handleSelectItem(conversationId, 'conversation');
  };

  const handleAppCreated = (newApp: UserApp) => {
    refreshSidebarData();
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

  const renderRightPanelContent = () => {
    if (isFileLoading) {
      return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    if (rightPanelView === 'editor' && activeFile && selectedItem?.type === 'app') {
      return <CodeEditorPanel appId={selectedItem.id} file={activeFile} onClose={() => { setActiveFile(null); setRightPanelView('preview'); }} onSwitchToPreview={() => setRightPanelView('preview')} />;
    }
    return <AppBrowserPanel appId={selectedAppDetails?.id || null} appUrl={selectedAppDetails?.url || null} appStatus={selectedAppDetails?.status || null} />;
  };

  return (
    <div className="h-screen bg-background flex">
      <div className="w-[320px] flex-shrink-0">
        <ConversationSidebar
          selectedItem={selectedItem}
          onSelectItem={handleSelectItem}
          onFileSelect={handleFileSelect}
          onOpenProfileSettings={handleOpenProfileSettings}
          onOpenAppSettings={handleOpenAppSettings}
          onOpenServerManagement={handleOpenServerManagement}
          onOpenUserManagement={handleOpenUserManagement}
          onOpenDeepAiCoder={handleOpenDeepAiCoder}
        />
      </div>
      <div className="flex-1 min-w-0">
        {selectedItem?.type === 'note' ? (
          <NoteEditorPanel noteId={selectedItem.id} onNoteUpdated={refreshSidebarData} />
        ) : (
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={50} minSize={30}>
              <ChatInterface
                userId={userId}
                conversationId={selectedItem?.conversationId || null}
                onNewConversationCreated={handleNewConversationCreated}
                onConversationTitleUpdate={(id, newTitle) => {}}
                aiResponseSpeed={aiResponseSpeed}
              />
            </ResizablePanel>
            {selectedItem?.type === 'app' && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={50} minSize={30}>
                  {renderRightPanelContent()}
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        )}
      </div>

      <ProfileSettingsDialog open={isProfileSettingsOpen} onOpenChange={setIsProfileSettingsOpen} />
      <AppSettingsDialog
        open={isAppSettingsOpen}
        onOpenChange={setIsAppSettingsOpen}
        aiResponseSpeed={aiResponseSpeed}
        onAiResponseSpeedChange={handleAiResponseSpeedChange}
      />
      {isAdmin && <ServerManagementDialog open={isServerManagementOpen} onOpenChange={setIsServerManagementOpen} />}
      {isAdmin && <UserManagementDialog open={isUserManagementOpen} onOpenChange={setIsUserManagementOpen} />}
      <DeepAiCoderDialog open={isDeepAiCoderOpen} onOpenChange={setIsDeepAiCoderOpen} onAppCreated={handleAppCreated} />
    </div>
  );
}