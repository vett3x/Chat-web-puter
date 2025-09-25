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
import { RetryUploadDialog } from "@/components/retry-upload-dialog";
import { UpdateManagerDialog } from "@/components/update-manager-dialog";
import { ApiManagementDialog } from "@/components/api-management-dialog";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useSidebarData } from "@/hooks/use-sidebar-data";
import { useUserApiKeys } from "@/hooks/use-user-api-keys"; // NEW: Import useUserApiKeys

interface UserApp {
  id: string;
  name: string;
  status: string;
  url: string | null;
  conversation_id: string | null;
  prompt: string | null;
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

interface RetryState {
  isOpen: boolean;
  files: { path: string; content: string }[] | null;
}

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

  const { userApiKeys, isLoadingApiKeys } = useUserApiKeys(); // NEW: Get user API keys

  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [selectedAppDetails, setSelectedAppDetails] = useState<UserApp | null>(null);
  
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const [isAppSettingsOpen, setIsAppSettingsOpen] = useState(false);
  const [isServerManagementOpen, setIsServerManagementOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isDeepAiCoderOpen, setIsDeepAiCoderOpen] = useState(false);
  const [isUpdateManagerOpen, setIsUpdateManagerOpen] = useState(false);
  const [isApiManagementOpen, setIsApiManagementOpen] = useState(false);
  
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
  const [retryState, setRetryState] = useState<RetryState>({ isOpen: false, files: null });
  const appBrowserRef = useRef<{ refresh: () => void }>(null);
  const [fileTreeRefreshKey, setFileTreeRefreshKey] = useState(0);

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
      const response = await fetch(`/api/apps/${selectedItem.id}/files?path=${encodeURIComponent(path)}`);
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

  const writeFilesToApp = async (files: { path: string; content: string }[]) => {
    if (!selectedAppDetails?.id || files.length === 0) return;

    const toastId = toast.loading(`Aplicando ${files.length} archivo(s)...`);
    try {
      const response = await fetch(`/api/apps/${selectedAppDetails.id}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Error del servidor al guardar los archivos.');
      }
      toast.success(`Archivos aplicados. Reiniciando servidor...`, { id: toastId });

      // Now, restart the server
      const restartResponse = await fetch(`/api/apps/${selectedAppDetails.id}/restart`, { method: 'POST' });
      const restartResult = await restartResponse.json();
      if (!restartResponse.ok) {
        throw new Error(restartResult.message || 'Error al reiniciar el servidor.');
      }
      
      toast.success(`¡Listo! Actualizando vista previa...`, { id: toastId });
      
      // Force refresh of file tree and browser preview
      setFileTreeRefreshKey(prev => prev + 1);
      setTimeout(() => appBrowserRef.current?.refresh(), 2000); // Delay to allow server to restart

    } catch (error: any) {
      console.error("Error writing files or restarting:", error);
      toast.error(`Error: ${error.message}`, { id: toastId });
      setRetryState({ isOpen: true, files: files });
    }
  };

  const handleRetryUpload = () => {
    if (retryState.files) {
      writeFilesToApp(retryState.files);
    }
    setRetryState({ isOpen: false, files: null });
  };

  const handleOpenProfileSettings = () => setIsProfileSettingsOpen(true);
  const handleOpenAppSettings = () => setIsAppSettingsOpen(true);
  const handleOpenServerManagement = () => setIsServerManagementOpen(true);
  const handleOpenUserManagement = () => setIsUserManagementOpen(true);
  const handleOpenDeepAiCoder = () => setIsDeepAiCoderOpen(true);
  const handleOpenUpdateManager = () => setIsUpdateManagerOpen(true);
  const handleOpenApiManagement = () => setIsApiManagementOpen(true);

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
          onOpenUpdateManager={handleOpenUpdateManager}
          onOpenApiManagement={handleOpenApiManagement}
          refreshData={refreshSidebarData}
          createConversation={createConversation as any}
          createFolder={createFolder}
          createNote={createNote as any}
          moveItem={moveItem}
          onDeleteApp={handleDeleteApp}
          isDeletingAppId={isDeletingAppId}
          fileTreeRefreshKey={fileTreeRefreshKey}
        />
      </div>
      <div className="flex-1 min-w-0">
        {selectedItem?.type === 'note' ? (
          <NoteEditorPanel
            noteId={selectedItem.id}
            onNoteUpdated={refreshSidebarData}
            userApiKeys={userApiKeys} // NEW: Pass userApiKeys
            isLoadingApiKeys={isLoadingApiKeys} // NEW: Pass isLoadingApiKeys
          />
        ) : (
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={50} minSize={30}>
              <ChatInterface
                key={selectedItem?.conversationId || 'no-conversation'}
                userId={userId}
                conversationId={selectedItem?.conversationId || null}
                onNewConversationCreated={handleNewConversationCreated}
                onConversationTitleUpdate={(id, newTitle) => {}}
                aiResponseSpeed={aiResponseSpeed}
                isAppProvisioning={selectedAppDetails?.status === 'provisioning'}
                isAppDeleting={isAppDeleting}
                appPrompt={selectedAppDetails?.prompt}
                appId={selectedAppDetails?.id}
                onWriteFiles={writeFilesToApp}
                isAppChat={selectedItem?.type === 'app'}
                onSidebarDataRefresh={refreshSidebarData}
                userApiKeys={userApiKeys} // NEW: Pass userApiKeys
                isLoadingApiKeys={isLoadingApiKeys} // NEW: Pass isLoadingApiKeys
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
      {isAdmin && <ApiManagementDialog open={isApiManagementOpen} onOpenChange={setIsApiManagementOpen} />}
      <DeepAiCoderDialog open={isDeepAiCoderOpen} onOpenChange={setIsDeepAiCoderOpen} onAppCreated={handleAppCreated} />
      <RetryUploadDialog
        open={retryState.isOpen}
        onOpenChange={(open) => setRetryState({ ...retryState, isOpen: open })}
        onRetry={handleRetryUpload}
        fileCount={retryState.files?.length || 0}
      />
      {userRole === 'super_admin' && <UpdateManagerDialog open={isUpdateManagerOpen} onOpenChange={setIsUpdateManagerOpen} />}
    </div>
  );
}