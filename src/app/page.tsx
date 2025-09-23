"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  prompt: string | null; // Added prompt
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
  
  const {
    apps,
    conversations,
    folders,
    notes,
    isLoading: isLoadingData,
    fetchData: refreshSidebarData,
    createConversation,
    createFolder,
    createNote,
    moveItem,
  } = useSidebarData();

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
  const [isDeletingAppId, setIsDeletingAppId] = useState<string | null>(null);
  const appBrowserRef = useRef<{ refresh: () => void }>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aiResponseSpeed', aiResponseSpeed);
    }
  }, [aiResponseSpeed]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    const checkAppStatus = async () => {
      if (!selectedAppDetails?.id) return;
      const { data: updatedApp } = await supabase.from('user_apps').select('*').eq('id', selectedAppDetails.id).single();
      if (updatedApp && updatedApp.status !== 'provisioning') {
        setSelectedAppDetails(updatedApp);
        if (updatedApp.status === 'ready') {
          toast.success(`La aplicación "${updatedApp.name}" está lista.`);
          refreshSidebarData();
        } else {
          toast.error(`Falló el aprovisionamiento de "${updatedApp.name}".`);
        }
        if (intervalId) clearInterval(intervalId);
      }
    };
    if (selectedAppDetails?.status === 'provisioning') {
      intervalId = setInterval(checkAppStatus, 5000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [selectedAppDetails, refreshSidebarData]);

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

  const handleAppCreated = async (newApp: UserApp) => {
    await refreshSidebarData();
    handleSelectItem(newApp.id, 'app');
  };

  const handleDeleteApp = async (appId: string) => {
    setIsDeletingAppId(appId);
    try {
      const response = await fetch(`/api/apps/${appId}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      if (selectedItem?.id === appId) {
        handleSelectItem(null, null);
      }
      await refreshSidebarData();
    } catch (error: any) {
      toast.error(`Error al eliminar el proyecto: ${error.message}`);
    } finally {
      setIsDeletingAppId(null);
    }
  };

  const handleFilesWritten = () => {
    refreshSidebarData();
    // Add a small delay to allow the server to process file changes before refreshing
    setTimeout(() => {
      appBrowserRef.current?.refresh();
    }, 1000);
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
  const isAppDeleting = selectedItem?.type === 'app' && selectedItem.id === isDeletingAppId;

  const renderRightPanelContent = () => {
    if (isAppDeleting) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
          <Loader2 className="h-12 w-12 animate-spin text-destructive mb-4" />
          <h3 className="text-lg font-semibold">Eliminando Proyecto</h3>
          <p>Por favor, espera mientras se eliminan todos los recursos asociados...</p>
        </div>
      );
    }
    if (isFileLoading) {
      return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    if (rightPanelView === 'editor' && activeFile && selectedItem?.type === 'app') {
      return <CodeEditorPanel appId={selectedItem.id} file={activeFile} onClose={() => { setActiveFile(null); setRightPanelView('preview'); }} onSwitchToPreview={() => setRightPanelView('preview')} />;
    }
    return <AppBrowserPanel ref={appBrowserRef} appId={selectedAppDetails?.id || null} appUrl={selectedAppDetails?.url || null} appStatus={selectedAppDetails?.status || null} />;
  };

  return (
    <div className="h-screen bg-background flex">
      <div className="w-[320px] flex-shrink-0">
        <ConversationSidebar
          apps={apps}
          conversations={conversations}
          folders={folders}
          notes={notes}
          isLoading={isLoadingData}
          selectedItem={selectedItem}
          onSelectItem={handleSelectItem}
          onFileSelect={handleFileSelect}
          onOpenProfileSettings={handleOpenProfileSettings}
          onOpenAppSettings={handleOpenAppSettings}
          onOpenServerManagement={handleOpenServerManagement}
          onOpenUserManagement={handleOpenUserManagement}
          onOpenDeepAiCoder={handleOpenDeepAiCoder}
          refreshData={refreshSidebarData}
          createConversation={createConversation as any}
          createFolder={createFolder}
          createNote={createNote as any}
          moveItem={moveItem}
          onDeleteApp={handleDeleteApp}
          isDeletingAppId={isDeletingAppId}
        />
      </div>
      <div className="flex-1 min-w-0">
        {selectedItem?.type === 'note' ? (
          <NoteEditorPanel noteId={selectedItem.id} onNoteUpdated={refreshSidebarData} />
        ) : (
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={50} minSize={30}>
              <ChatInterface
                key={selectedItem?.conversationId || 'no-conversation'} // Force re-mount on conversation change
                userId={userId}
                conversationId={selectedItem?.conversationId || null}
                onNewConversationCreated={handleNewConversationCreated}
                onConversationTitleUpdate={(id, newTitle) => {}}
                aiResponseSpeed={aiResponseSpeed}
                isAppProvisioning={selectedAppDetails?.status === 'provisioning'}
                isAppDeleting={isAppDeleting}
                appPrompt={selectedAppDetails?.prompt}
                appId={selectedAppDetails?.id}
                onFilesWritten={handleFilesWritten}
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