"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from '@/components/session-context-provider';
import { useUserApiKeys, ApiKey, AiKeyGroup } from '@/hooks/use-user-api-keys';
import { ConversationSidebar } from '@/components/conversation-sidebar';
import { ChatInterface, ChatInterfaceRef } from '@/components/chat-interface';
import { AppBrowserPanel } from '@/components/app-browser-panel';
import { NoteEditorPanel, NoteEditorPanelRef } from '@/components/note-editor-panel';
import { ProfileSettingsDialog } from '@/components/profile-settings-dialog';
import { AccountSettingsDialog } from '@/components/account-settings-dialog';
import { AdminPanelDialog } from '@/components/admin-panel-dialog';
import { UserManagementDialog } from '@/components/user-management-dialog';
import { DeepAiCoderDialog } from '@/components/deep-ai-coder-dialog';
import { UpdateManagerDialog } from '@/components/update-manager-dialog';
import { ApiManagementDialog } from '@/components/api-management-dialog';
import { AlertsDialog } from '@/components/alerts-dialog';
import { StorageManagementDialog } from '@/components/storage-management-dialog';
import { SupportTicketDialog } from '@/components/support-ticket-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileHeader } from '@/components/mobile-header';
import { Button } from '@/components/ui/button';
import { PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import LiquidEther from '@/components/liquid-ether';

type SelectedItem = { id: string; type: 'app' | 'conversation' | 'note' | 'folder' };

export default function AppPage() {
  const { session, userRole, userDefaultModel, hasNewUserSupportTickets } = useSession();
  const { userApiKeys, aiKeyGroups, isLoadingApiKeys, refreshApiKeys } = useUserApiKeys();
  const router = useRouter();

  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [fileTreeRefreshKey, setFileTreeRefreshKey] = useState(0);

  // Dialog states
  const [dialogs, setDialogs] = useState({
    profileSettings: false,
    accountSettings: false,
    adminPanel: false,
    userManagement: false,
    deepAiCoder: false,
    updateManager: false,
    apiManagement: false,
    alerts: false,
    storageManagement: false,
    supportTicket: false,
  });
  const [adminPanelInitialTab, setAdminPanelInitialTab] = useState('dashboard');

  const [isDeletingAppId, setIsDeletingAppId] = useState<string | null>(null);
  const [aiResponseSpeed, setAiResponseSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');

  const chatInterfaceRef = useRef<ChatInterfaceRef>(null);
  const noteEditorRef = useRef<NoteEditorPanelRef>(null);
  const appBrowserRef = useRef<{ refresh: () => void }>(null);

  const isMobile = useIsMobile();

  useEffect(() => {
    setIsSidebarOpen(!isMobile);
  }, [isMobile]);

  const handleSelectItem = (id: string | null, type: SelectedItem['type'] | null) => {
    if (id && type) {
      setSelectedItem({ id, type });
      setSelectedFile(null);
      if (isMobile) setIsSidebarOpen(false);
    } else {
      setSelectedItem(null);
    }
  };

  const handleFileSelect = (path: string) => {
    setSelectedFile(path);
    if (isMobile) setIsSidebarOpen(false);
  };

  const handleOpenDialog = (dialog: keyof typeof dialogs, initialTab?: string) => {
    if (dialog === 'adminPanel' && initialTab) {
      setAdminPanelInitialTab(initialTab);
    }
    setDialogs(prev => ({ ...prev, [dialog]: true }));
  };

  const handleAppCreated = (newApp: any) => {
    onSidebarDataRefresh();
    handleSelectItem(newApp.id, 'app');
  };

  const onSidebarDataRefresh = () => {
    // This function can be expanded if child components need to trigger a full refresh
  };

  const handleDeleteApp = async (appId: string) => {
    setIsDeletingAppId(appId);
    try {
      const response = await fetch(`/api/apps/${appId}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      if (selectedItem?.id === appId) {
        setSelectedItem(null);
      }
      onSidebarDataRefresh();
    } catch (error: any) {
      toast.error(`Error al eliminar la aplicación: ${error.message}`);
    } finally {
      setIsDeletingAppId(null);
    }
  };

  const handleWriteFiles = async (files: { path: string; content: string }[]) => {
    if (selectedItem?.type !== 'app') {
      toast.error("No hay una aplicación seleccionada para escribir los archivos.");
      return;
    }
    try {
      const response = await fetch(`/api/apps/${selectedItem.id}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || 'No se pudieron guardar los archivos.');
      }
      toast.success(`${files.length} archivo(s) guardado(s) correctamente.`);
      setFileTreeRefreshKey(prev => prev + 1);
      if (appBrowserRef.current) {
        setTimeout(() => appBrowserRef.current?.refresh(), 1000);
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const renderMainContent = () => {
    if (selectedItem?.type === 'app') {
      const app = { id: selectedItem.id, url: null, status: null }; // Simplified for now
      return (
        <div className="flex h-full">
          <div className="flex-1">
            <AppBrowserPanel
              ref={appBrowserRef}
              appId={app.id}
              appUrl={app.url}
              appStatus={app.status}
              isAppDeleting={isDeletingAppId === app.id}
              onRefreshAppDetails={onSidebarDataRefresh}
            />
          </div>
          <div className="w-[40%] border-l">
            <ChatInterface
              ref={chatInterfaceRef}
              userId={session?.user?.id}
              conversationId={null} // This will be fetched inside
              onNewConversationCreated={() => {}}
              onConversationTitleUpdate={() => {}}
              aiResponseSpeed={aiResponseSpeed}
              appId={app.id}
              appPrompt={null} // This will be fetched inside
              onWriteFiles={handleWriteFiles}
              isAppChat={true}
              onSidebarDataRefresh={onSidebarDataRefresh}
              userApiKeys={userApiKeys}
              aiKeyGroups={aiKeyGroups}
              isLoadingApiKeys={isLoadingApiKeys}
              userDefaultModel={userDefaultModel}
            />
          </div>
        </div>
      );
    }
    if (selectedItem?.type === 'note') {
      return (
        <NoteEditorPanel
          ref={noteEditorRef}
          noteId={selectedItem.id}
          onNoteUpdated={() => {}}
          userApiKeys={userApiKeys}
          aiKeyGroups={aiKeyGroups}
          isLoadingApiKeys={isLoadingApiKeys}
          userLanguage={session?.user?.id || 'es'}
          userDefaultModel={userDefaultModel}
        />
      );
    }
    return (
      <ChatInterface
        ref={chatInterfaceRef}
        userId={session?.user?.id}
        conversationId={selectedItem?.type === 'conversation' ? selectedItem.id : null}
        onNewConversationCreated={(id) => handleSelectItem(id, 'conversation')}
        onConversationTitleUpdate={() => {}}
        aiResponseSpeed={aiResponseSpeed}
        onWriteFiles={handleWriteFiles}
        onSidebarDataRefresh={onSidebarDataRefresh}
        userApiKeys={userApiKeys}
        aiKeyGroups={aiKeyGroups}
        isLoadingApiKeys={isLoadingApiKeys}
        userDefaultModel={userDefaultModel}
      />
    );
  };

  return (
    <div className="relative h-[100dvh] w-screen flex flex-col md:flex-row bg-background text-foreground overflow-hidden">
      <div className="absolute inset-0 z-0" style={{ opacity: 'var(--liquid-ether-opacity, 0.5)' }}>
        <LiquidEther
          colors={[ '#5227FF', '#FF9FFC', '#B19EEF' ]}
          mouseForce={20}
          cursorSize={100}
          isViscous={false}
          viscous={30}
          iterationsViscous={32}
          iterationsPoisson={32}
          resolution={0.5}
          isBounce={false}
          autoDemo={true}
          autoSpeed={0.5}
          autoIntensity={2.2}
          takeoverDuration={0.25}
          autoResumeDelay={3000}
          autoRampDuration={0.6}
        />
      </div>
      {isMobile && (
        <MobileHeader>
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(prev => !prev)}>
            {isSidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
          </Button>
        </MobileHeader>
      )}
      <aside className={cn(
        "flex-shrink-0 transition-all duration-300 ease-in-out z-20", // Added z-20
        isMobile ? "absolute top-14 left-0 h-[calc(100%-56px)]" : "relative",
        isSidebarOpen ? "w-72" : "w-0"
      )}>
        <ConversationSidebar
          selectedItem={selectedItem}
          onSelectItem={handleSelectItem}
          onFileSelect={handleFileSelect}
          onOpenProfileSettings={() => handleOpenDialog('profileSettings')}
          onOpenAccountSettings={() => handleOpenDialog('accountSettings')}
          onOpenAdminPanel={(initialTab) => handleOpenDialog('adminPanel', initialTab)}
          onOpenUserManagement={() => handleOpenDialog('userManagement')}
          onOpenDeepAiCoder={() => handleOpenDialog('deepAiCoder')}
          onOpenUpdateManager={() => handleOpenDialog('updateManager')}
          onOpenApiManagement={() => handleOpenDialog('apiManagement')}
          onOpenAlerts={() => handleOpenDialog('alerts')}
          onDeleteApp={handleDeleteApp}
          isDeletingAppId={isDeletingAppId}
          fileTreeRefreshKey={fileTreeRefreshKey}
          onOpenStorageManagement={() => handleOpenDialog('storageManagement')}
          onOpenSupportTicket={() => handleOpenDialog('supportTicket')}
          hasNewUserSupportTickets={hasNewUserSupportTickets}
        />
      </aside>
      <main className="relative z-10 flex-1 flex flex-col overflow-hidden">
        {renderMainContent()}
      </main>

      {/* Dialogs */}
      <ProfileSettingsDialog open={dialogs.profileSettings} onOpenChange={(open) => setDialogs(p => ({ ...p, profileSettings: open }))} />
      <AccountSettingsDialog
        open={dialogs.accountSettings}
        onOpenChange={(open) => setDialogs(p => ({ ...p, accountSettings: open }))}
        aiResponseSpeed={aiResponseSpeed}
        onAiResponseSpeedChange={setAiResponseSpeed}
        userApiKeys={userApiKeys}
        aiKeyGroups={aiKeyGroups}
        isLoadingApiKeys={isLoadingApiKeys}
        currentUserRole={userRole}
      />
      <AdminPanelDialog open={dialogs.adminPanel} onOpenChange={(open) => setDialogs(p => ({ ...p, adminPanel: open }))} onOpenAlerts={() => handleOpenDialog('alerts')} initialTab={adminPanelInitialTab} />
      <UserManagementDialog open={dialogs.userManagement} onOpenChange={(open) => setDialogs(p => ({ ...p, userManagement: open }))} />
      <DeepAiCoderDialog open={dialogs.deepAiCoder} onOpenChange={(open) => setDialogs(p => ({ ...p, deepAiCoder: open }))} onAppCreated={handleAppCreated} />
      <UpdateManagerDialog open={dialogs.updateManager} onOpenChange={(open) => setDialogs(p => ({ ...p, updateManager: open }))} />
      <ApiManagementDialog open={dialogs.apiManagement} onOpenChange={(open) => setDialogs(p => ({ ...p, apiManagement: open }))} />
      <AlertsDialog open={dialogs.alerts} onOpenChange={(open) => setDialogs(p => ({ ...p, alerts: open }))} />
      <StorageManagementDialog open={dialogs.storageManagement} onOpenChange={(open) => setDialogs(p => ({ ...p, storageManagement: open }))} />
      <SupportTicketDialog open={dialogs.supportTicket} onOpenChange={(open) => setDialogs(p => ({ ...p, supportTicket: open }))} />
    </div>
  );
}