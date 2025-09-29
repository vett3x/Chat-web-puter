"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "@/components/session-context-provider";
import { ConversationSidebar } from "@/components/conversation-sidebar";
import { ChatInterface, ChatInterfaceRef } from "@/components/chat-interface"; // Import ChatInterfaceRef
import { AppBrowserPanel } from "@/components/app-browser-panel";
import { CodeEditorPanel } from "@/components/code-editor-panel";
import { NoteEditorPanel, NoteEditorPanelRef } from "@/components/note-editor-panel"; // Import NoteEditorPanelRef
import { ProfileSettingsDialog } from "@/components/profile-settings-dialog";
import { AccountSettingsDialog } from "@/components/account-settings-dialog";
import { ServerManagementDialog } from "@/components/server-management-dialog";
import { UserManagementDialog } from "@/components/user-management-dialog";
import { DeepAiCoderDialog } from "@/components/deep-ai-coder-dialog";
import { RetryUploadDialog } from "@/components/retry-upload-dialog";
import { UpdateManagerDialog } from "@/components/update-manager-dialog";
import { ApiManagementDialog } from "@/components/api-management-dialog";
import { AlertsDialog } from "@/components/alerts-dialog"; // Import the new dialog
import { AppVersionsBar } from "@/components/app-versions-bar";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react"; // Import ShieldAlert
import { useSidebarData } from "@/hooks/use-sidebar-data";
import { useUserApiKeys } from "@/hooks/use-user-api-keys";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
  const { session, isLoading: isSessionLoading, userRole, userLanguage, isUserTemporarilyDisabled } = useSession(); // NEW: Get isUserTemporarilyDisabled
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
    updateLocalItem,
    removeLocalItem,
  } = useSidebarData();

  const { userApiKeys, isLoadingApiKeys } = useUserApiKeys();

  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [selectedAppDetails, setSelectedAppDetails] = useState<UserApp | null>(null);
  
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const [isServerManagementOpen, setIsServerManagementOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isDeepAiCoderOpen, setIsDeepAiCoderOpen] = useState(false);
  const [isUpdateManagerOpen, setIsUpdateManagerOpen] = useState(false);
  const [isApiManagementOpen, setIsApiManagementOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  
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
  const [isRevertingApp, setIsRevertingApp] = useState(false);
  const [retryState, setRetryState] = useState<RetryState>({ isOpen: false, files: null });
  const appBrowserRef = useRef<{ refresh: () => void }>(null);
  const [fileTreeRefreshKey, setFileTreeRefreshKey] = useState(0);

  const chatInterfaceRef = useRef<ChatInterfaceRef>(null); // Use ChatInterfaceRef
  const noteEditorRef = useRef<NoteEditorPanelRef>(null); // Use NoteEditorPanelRef

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

  // NEW: Effect to handle tab visibility changes - REMOVED, now handled by useSidebarData polling
  // useEffect(() => {
  //   const handleVisibilityChange = () => {
  //     if (document.visibilityState === 'visible') {
  //       console.log("[Home] Tab became visible. Refreshing data...");
  //       refreshSidebarData(); // Refresh all sidebar data
  //       // NoteEditorPanel's internal fetchNote will be triggered by its noteId dependency
  //       // when refreshSidebarData causes a re-render.
  //     }
  //   };

  //   document.addEventListener('visibilitychange', handleVisibilityChange);

  //   return () => {
  //     document.removeEventListener('visibilitychange', handleVisibilityChange);
  //   };
  // }, [refreshSidebarData]);

  // NEW: Effect to refresh active content after sidebar data refresh
  useEffect(() => {
    const refreshActiveContent = async () => {
      // This effect runs whenever refreshSidebarData is called (e.g., by polling)
      // We need to ensure the selected item's content is also refreshed.
      if (selectedItem) {
        if (selectedItem.type === 'note' && noteEditorRef.current) {
          console.log("[Home] Refreshing active note content...");
          noteEditorRef.current.refreshNoteContent();
        } else if ((selectedItem.type === 'conversation' || selectedItem.type === 'app') && chatInterfaceRef.current) {
          console.log("[Home] Refreshing active chat messages...");
          chatInterfaceRef.current.refreshChatMessages();
        }
      }
    };

    // We need to call refreshActiveContent *after* refreshSidebarData has completed its fetch.
    // Since refreshSidebarData is a callback, we can't directly put this in its `finally` block.
    // A simple way is to trigger this effect whenever `isLoadingData` (from useSidebarData) changes from true to false.
    if (!isLoadingData) {
      refreshActiveContent();
    }
  }, [isLoadingData, selectedItem]); // Depend on isLoadingData and selectedItem

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

    console.log("[Home] writeFilesToApp called with files:", files);

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

      const restartResponse = await fetch(`/api/apps/${selectedAppDetails.id}/restart`, { method: 'POST' });
      const restartResult = await restartResponse.json();
      if (!restartResponse.ok) {
        throw new Error(restartResult.message || 'Error al reiniciar el servidor.');
      }
      
      toast.success(`¡Listo! Actualizando vista previa...`, { id: toastId });
      
      setFileTreeRefreshKey(prev => prev + 1);
      setTimeout(() => appBrowserRef.current?.refresh(), 2000);

    } catch (error: any) {
      console.error("[Home] Error writing files or restarting:", error);
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

  const handleRevertToVersion = async (timestamp: string) => {
    if (!selectedAppDetails?.id) return;

    setIsRevertingApp(true);
    const toastId = toast.loading(`Restaurando a la versión del ${format(new Date(timestamp), 'dd/MM/yyyy HH:mm', { locale: es })}...`);

    try {
      const response = await fetch(`/api/apps/${selectedAppDetails.id}/versions?timestamp=${encodeURIComponent(timestamp)}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const filesToRevert: { file_path: string; file_content: string }[] = await response.json();

      if (filesToRevert.length === 0) {
        throw new Error('No se encontraron archivos para esta versión.');
      }

      const formattedFiles = filesToRevert.map(f => ({ path: f.file_path, content: f.file_content }));
      await writeFilesToApp(formattedFiles);

      toast.success('Aplicación restaurada a la versión seleccionada.', { id: toastId });
      setFileTreeRefreshKey(prev => prev + 1);
      appBrowserRef.current?.refresh();

    } catch (error: any) {
      console.error('Error reverting to version:', error);
      toast.error(`Error al restaurar la versión: ${error.message}`, { id: toastId });
    } finally {
      setIsRevertingApp(false);
    }
  };

  const handleTriggerFixBuildError = () => {
    if (chatInterfaceRef.current && chatInterfaceRef.current.triggerFixBuildError) {
      chatInterfaceRef.current.triggerFixBuildError();
    } else {
      toast.error("El chat no está listo para corregir errores de compilación.");
    }
  };

  const handleTriggerReportWebError = () => {
    if (chatInterfaceRef.current && chatInterfaceRef.current.triggerReportWebError) {
      chatInterfaceRef.current.triggerReportWebError();
    } else {
      toast.error("El chat no está listo para reportar errores web.");
    }
  };

  const handleOpenProfileSettings = () => setIsProfileSettingsOpen(true);
  const handleOpenAccountSettings = () => setIsAccountSettingsOpen(true);
  const handleOpenServerManagement = () => setIsServerManagementOpen(true);
  const handleOpenUserManagement = () => setIsUserManagementOpen(true);
  const handleOpenDeepAiCoder = () => setIsDeepAiCoderOpen(true);
  const handleOpenUpdateManager = () => setIsUpdateManagerOpen(true);
  const handleOpenApiManagement = () => setIsApiManagementOpen(true);
  const handleOpenAlerts = () => setIsAlertsOpen(true);
  
  const handleAiResponseSpeedChange = (speed: 'slow' | 'normal' | 'fast') => {
    setAiResponseSpeed(speed);
  };

  const isAdmin = userRole === 'admin' || userRole === 'super_admin';
  const isAppDeleting = selectedItem?.type === 'app' && selectedItem.id === isDeletingAppId;

  // Define these variables from selectedAppDetails
  const appId = selectedAppDetails?.id || undefined;
  const appPrompt = selectedAppDetails?.prompt || undefined;
  const isAppProvisioning = selectedAppDetails?.status === 'provisioning';

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
    <div className="h-screen bg-background flex relative">
      {isUserTemporarilyDisabled && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-center p-4 pointer-events-auto">
          <ShieldAlert className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-destructive">Acceso Restringido</h2>
          <p className="text-muted-foreground mt-2">
            Tu cuenta ha sido temporalmente deshabilitada o expulsada.
            Por favor, contacta al soporte para más información.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Se ha cerrado tu sesión. Recarga la página o intenta iniciar sesión de nuevo.
          </p>
        </div>
      )}

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
          onOpenAccountSettings={handleOpenAccountSettings}
          onOpenServerManagement={handleOpenServerManagement}
          onOpenUserManagement={handleOpenUserManagement}
          onOpenDeepAiCoder={handleOpenDeepAiCoder}
          onOpenUpdateManager={handleOpenUpdateManager}
          onOpenApiManagement={handleOpenApiManagement}
          onOpenAlerts={handleOpenAlerts}
          refreshData={refreshSidebarData}
          createConversation={createConversation as any}
          createFolder={createFolder}
          createNote={createNote as any}
          moveItem={moveItem}
          onDeleteApp={handleDeleteApp}
          isDeletingAppId={isDeletingAppId}
          fileTreeRefreshKey={fileTreeRefreshKey}
          updateLocalItem={updateLocalItem}
          removeLocalItem={removeLocalItem}
        />
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        {selectedItem?.type === 'app' && selectedAppDetails && (
          <AppVersionsBar
            appId={selectedAppDetails.id}
            onRevertToVersion={handleRevertToVersion}
            isReverting={isRevertingApp}
            autoFixStatus={chatInterfaceRef.current?.autoFixStatus || 'idle'}
            onTriggerFixBuildError={handleTriggerFixBuildError}
            onTriggerReportWebError={handleTriggerReportWebError}
          />
        )}
        {selectedItem?.type === 'note' ? (
          <NoteEditorPanel
            ref={noteEditorRef} // Assign ref here
            noteId={selectedItem.id}
            onNoteUpdated={(id, data) => updateLocalItem(id, 'note', data)}
            userApiKeys={userApiKeys}
            isLoadingApiKeys={isLoadingApiKeys}
            userLanguage={userLanguage || 'es'}
          />
        ) : (
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            <ResizablePanel defaultSize={50} minSize={30}>
              <ChatInterface
                ref={chatInterfaceRef}
                key={selectedItem?.conversationId || 'no-conversation'}
                userId={userId}
                conversationId={selectedItem?.conversationId || null}
                onNewConversationCreated={handleNewConversationCreated}
                onConversationTitleUpdate={(id, newTitle) => {}}
                aiResponseSpeed={aiResponseSpeed}
                isAppProvisioning={isAppProvisioning}
                isAppDeleting={isAppDeleting}
                appPrompt={appPrompt}
                appId={appId}
                onWriteFiles={writeFilesToApp}
                isAppChat={selectedItem?.type === 'app'}
                onSidebarDataRefresh={refreshSidebarData}
                userApiKeys={userApiKeys}
                isLoadingApiKeys={isLoadingApiKeys}
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
      <AccountSettingsDialog
        open={isAccountSettingsOpen}
        onOpenChange={setIsAccountSettingsOpen}
        aiResponseSpeed={aiResponseSpeed}
        onAiResponseSpeedChange={handleAiResponseSpeedChange}
        userApiKeys={userApiKeys}
        isLoadingApiKeys={isLoadingApiKeys}
        currentUserRole={userRole}
      />
      {isAdmin && <ServerManagementDialog open={isServerManagementOpen} onOpenChange={setIsServerManagementOpen} />}
      {isAdmin && <UserManagementDialog open={isUserManagementOpen} onOpenChange={setIsUserManagementOpen} />}
      <ApiManagementDialog open={isApiManagementOpen} onOpenChange={setIsApiManagementOpen} />
      {isAdmin && <AlertsDialog open={isAlertsOpen} onOpenChange={setIsAlertsOpen} />}
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