"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/components/session-context-provider";
import { ConversationSidebar } from "@/components/conversation-sidebar";
import { ChatInterface } from "@/components/chat-interface";
import { AppPreviewPanel } from "@/components/app-preview-panel";
import { CodeEditorPanel } from "@/components/code-editor-panel";
import { NoteEditorPanel } from "@/components/note-editor-panel"; // Import new component
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

interface UserApp {
  id: string;
  name: string;
  status: string;
  url: string | null;
  conversation_id: string | null;
}

interface SelectedItem {
  id: string;
  type: 'app' | 'conversation' | 'note'; // Add 'note' type
  conversationId?: string | null; // Make optional
}

interface ActiveFile {
  path: string;
  content: string;
}

type RightPanelView = 'chat' | 'editor' | 'preview' | 'note'; // Add 'note' view

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

  const [rightPanelView, setRightPanelView] = useState<RightPanelView>('chat');
  const [activeFile, setActiveFile] = useState<ActiveFile | null>(null);
  const [isFileLoading, setIsFileLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aiResponseSpeed', aiResponseSpeed);
    }
  }, [aiResponseSpeed]);

  const handleSelectItem = useCallback(async (id: string | null, type: 'app' | 'conversation' | 'note' | null) => {
    setActiveFile(null);
    setRightPanelView('chat');

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
      setRightPanelView('preview');
    } else if (type === 'conversation') {
      setSelectedAppDetails(null);
      setSelectedItem({ id, type, conversationId: id });
      setRightPanelView('chat');
    } else if (type === 'note') {
      setSelectedAppDetails(null);
      setSelectedItem({ id, type, conversationId: null });
      setRightPanelView('note'); // Switch to note editor view
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

  const renderRightPanel = () => {
    if (isFileLoading) {
      return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    if (rightPanelView === 'editor' && activeFile && selectedItem?.type === 'app') {
      return <CodeEditorPanel appId={selectedItem.id} file={activeFile} onClose={() => { setActiveFile(null); setRightPanelView('preview'); }} onSwitchToPreview={() => setRightPanelView('preview')} />;
    }
    if (rightPanelView === 'preview' && selectedItem?.type === 'app') {
      return <AppPreviewPanel appUrl={selectedAppDetails?.url || null} appStatus={selectedAppDetails?.status || null} />;
    }
    if (rightPanelView === 'note' && selectedItem?.type === 'note') {
      return <NoteEditorPanel noteId={selectedItem.id} onNoteUpdated={() => { /* We need to trigger a sidebar refresh here */ }} />;
    }
    // Default to chat interface
    return (
      <ChatInterface
        userId={userId}
        conversationId={selectedItem?.conversationId || null}
        onNewConversationCreated={handleNewConversationCreated}
        onConversationTitleUpdate={(id, newTitle) => {}}
        aiResponseSpeed={aiResponseSpeed}
      />
    );
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
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={100} minSize={30}>
            {renderRightPanel()}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Dialogs */}
      <ProfileSettingsDialog open={isProfileSettingsOpen} onOpenChange={setIsProfileSettingsOpen} />
      <AppSettingsDialog open={isAppSettingsOpen} onOpenChange={setIsAppSettingsOpen} aiResponseSpeed={aiResponseSpeed} onAiResponseSpeedChange={handleAiResponseSpeedChange} />
      {isAdmin && <ServerManagementDialog open={isServerManagementOpen} onOpenChange={setIsServerManagementOpen} />}
      {isAdmin && <UserManagementDialog open={isUserManagementOpen} onOpenChange={setIsUserManagementOpen} />}
      <DeepAiCoderDialog open={isDeepAiCoderOpen} onOpenChange={setIsDeepAiCoderOpen} onAppCreated={handleAppCreated} />
    </div>
  );
}