"use client";

import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, MessageSquare, ChevronRight, ChevronDown, Wand2, Code, FileText, Folder as FolderIcon } from 'lucide-react';
import { SidebarHeader } from './sidebar-header';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { DraggableFolderItem } from './draggable-folder-item';
import { DraggableConversationCard } from './draggable-conversation-card';
import { DraggableNoteItem } from './draggable-note-item';
import { DraggableAppItem } from './draggable-app-item';
import { toast } from 'sonner';
import { FileTree } from './file-tree';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  folder_id: string | null;
  order_index: number;
}
interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  user_id: string;
}
interface UserApp {
  id: string;
  name: string;
  status: string;
  url: string | null;
  conversation_id: string | null;
}
interface Note {
  id: string;
  title: string;
  folder_id: string | null;
}
interface SelectedItem {
  id: string;
  type: 'app' | 'conversation' | 'note' | 'folder';
}

interface ConversationSidebarProps {
  apps: UserApp[];
  conversations: Conversation[];
  folders: Folder[];
  notes: Note[];
  isLoading: boolean;
  selectedItem: SelectedItem | null;
  onSelectItem: (id: string | null, type: SelectedItem['type'] | null) => void;
  onFileSelect: (path: string) => void;
  onOpenProfileSettings: () => void;
  onOpenAppSettings: () => void;
  onOpenServerManagement: () => void;
  onOpenUserManagement: () => void;
  onOpenDeepAiCoder: () => void;
  refreshData: () => void;
  createConversation: (onSuccess: (newItem: Conversation) => void) => void;
  createFolder: (parentId?: string | null) => void;
  createNote: (onSuccess: (newItem: Note) => void) => void;
  moveItem: (itemId: string, itemType: 'conversation' | 'note' | 'folder', targetFolderId: string | null) => void;
  onDeleteApp: (appId: string) => void;
  isDeletingAppId: string | null;
}

export function ConversationSidebar({
  apps,
  conversations,
  folders,
  notes,
  isLoading,
  selectedItem,
  onSelectItem,
  onFileSelect,
  onOpenProfileSettings,
  onOpenAppSettings,
  onOpenServerManagement,
  onOpenUserManagement,
  onOpenDeepAiCoder,
  refreshData,
  createConversation,
  createFolder,
  createNote,
  moveItem,
  onDeleteApp,
  isDeletingAppId,
}: ConversationSidebarProps) {
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    apps: true,
    chats: true,
    notes: true,
    folders: true,
  });
  const [draggedItem, setDraggedItem] = useState<{ id: string; type: 'conversation' | 'note' | 'folder' } | null>(null);
  const [draggedOverFolder, setDraggedOverFolder] = useState<string | null>(null);

  const handleCreateConversation = async () => {
    setIsCreatingConversation(true);
    await createConversation((newItem) => onSelectItem(newItem.id, 'conversation'));
    setIsCreatingConversation(false);
  };

  const handleCreateFolder = async (parentId: string | null = null) => {
    setIsCreatingFolder(true);
    await createFolder(parentId);
    setIsCreatingFolder(false);
  };

  const handleCreateNote = async () => {
    setIsCreatingNote(true);
    await createNote((newItem) => onSelectItem(newItem.id, 'note'));
    setIsCreatingNote(false);
  };

  const handleDragStart = (e: React.DragEvent, id: string, type: 'conversation' | 'note' | 'folder') => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id, type }));
    setDraggedItem({ id, type });
  };

  const handleDrop = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedOverFolder(null);
    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;
    try {
      const { id, type } = JSON.parse(data);
      moveItem(id, type, targetFolderId);
    } catch (error) {
      toast.error('Error al mover el elemento.');
    }
  };

  const handleDragEnter = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedItem && (draggedItem.type === 'folder' ? draggedItem.id !== folderId : true)) {
      setDraggedOverFolder(folderId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedOverFolder === folderId) {
      setDraggedOverFolder(null);
    }
  };

  const renderSection = (title: string, icon: React.ReactNode, key: keyof typeof expandedSections, content: React.ReactNode) => (
    <>
      <div className="px-2 py-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2 cursor-pointer" onClick={() => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))}>
          {expandedSections[key] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {icon} {title}
        </h3>
      </div>
      {expandedSections[key] && <div className="space-y-1">{content}</div>}
    </>
  );

  return (
    <div className="flex flex-col h-full p-4 border-r bg-sidebar text-sidebar-foreground">
      <SidebarHeader onNewConversation={handleCreateConversation} onNewFolder={handleCreateFolder} onNewNote={handleCreateNote} isCreatingConversation={isCreatingConversation} isCreatingFolder={isCreatingFolder} isCreatingNote={isCreatingNote} onOpenProfileSettings={onOpenProfileSettings} onOpenAppSettings={onOpenAppSettings} onOpenServerManagement={onOpenServerManagement} onOpenUserManagement={onOpenUserManagement} onOpenDeepAiCoder={onOpenDeepAiCoder} />
      <ScrollArea className="flex-1" onDrop={(e) => handleDrop(e, null)} onDragOver={(e) => e.preventDefault()} onDragEnter={(e) => handleDragEnter(e, null)} onDragLeave={(e) => handleDragLeave(e, null)}>
        <div className="space-y-2">
          {isLoading ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />) : (
            <>
              {renderSection("Proyectos", <Wand2 className="h-4 w-4" />, "apps", apps.map(app => (
                <div key={app.id}>
                  <DraggableAppItem
                    app={app}
                    selected={selectedItem?.type === 'app' && selectedItem.id === app.id}
                    onSelect={() => onSelectItem(app.id, 'app')}
                    onDelete={onDeleteApp}
                    isDeleting={isDeletingAppId === app.id}
                  />
                  {selectedItem?.type === 'app' && selectedItem.id === app.id && <div className="border-l-2 border-sidebar-primary ml-2"><FileTree appId={app.id} onFileSelect={onFileSelect} /></div>}
                </div>
              )))}
              <Separator className="my-4 bg-sidebar-border" />
              {renderSection("Notas", <FileText className="h-4 w-4" />, "notes", notes.filter(n => !n.folder_id).map(note => (
                <DraggableNoteItem key={note.id} note={note} selected={selectedItem?.type === 'note' && selectedItem.id === note.id} onSelect={() => onSelectItem(note.id, 'note')} onDragStart={(e) => handleDragStart(e, note.id, 'note')} level={0} onNoteUpdated={refreshData} onNoteDeleted={refreshData} />
              )))}
              <Separator className="my-4 bg-sidebar-border" />
              {renderSection("Chats", <MessageSquare className="h-4 w-4" />, "chats", conversations.filter(c => !c.folder_id).map(conv => (
                <DraggableConversationCard key={conv.id} conversation={conv} selectedConversationId={selectedItem?.type === 'conversation' ? selectedItem.id : null} onSelectConversation={(id) => onSelectItem(id!, 'conversation')} onConversationUpdated={refreshData} onConversationDeleted={refreshData} onConversationMoved={() => {}} onConversationReordered={() => {}} allFolders={[]} level={0} onDragStart={(e) => handleDragStart(e, conv.id, 'conversation')} isDraggingOver={false} dropPosition={null} />
              )))}
              <Separator className="my-4 bg-sidebar-border" />
              {renderSection("Carpetas", <FolderIcon className="h-4 w-4" />, "folders", folders.filter(f => !f.parent_id).map(folder => (
                <DraggableFolderItem key={folder.id} folder={folder} level={0} selectedItem={selectedItem} onSelectItem={(id, type) => onSelectItem(id, type)} conversations={conversations} notes={notes} subfolders={folders} onFolderUpdated={refreshData} onFolderDeleted={refreshData} onItemMoved={moveItem} onCreateSubfolder={handleCreateFolder} onDragStart={handleDragStart} onDrop={handleDrop} isDraggingOver={draggedOverFolder === folder.id} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} draggedItemType={draggedItem?.type || null} />
              )))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}