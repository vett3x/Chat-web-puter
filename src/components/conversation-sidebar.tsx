"use client";

import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSession } from '@/components/session-context-provider';
import { Loader2, MessageSquare, ChevronRight, ChevronDown, Wand2, Code, FileText, Folder as FolderIcon } from 'lucide-react';
import { SidebarHeader } from './sidebar-header';
import { useSidebarData } from '@/hooks/use-sidebar-data';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { DraggableFolderItem } from './draggable-folder-item';
import { DraggableConversationCard } from './draggable-conversation-card';
import { toast } from 'sonner';
import { FileTree } from './file-tree';

// New component for notes
const DraggableNoteItem: React.FC<{ note: any; selected: boolean; onSelect: () => void; onDragStart: (e: React.DragEvent) => void }> = ({ note, selected, onSelect, onDragStart }) => (
  <Card
    className={cn(
      "cursor-pointer hover:bg-sidebar-accent transition-colors group relative",
      selected && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary"
    )}
    onClick={onSelect}
    draggable="true"
    onDragStart={onDragStart}
  >
    <CardContent className="py-1 px-1.5 flex items-center justify-between gap-1">
      <div className="flex items-center gap-1 flex-1 overflow-hidden">
        <FileText className="h-3 w-3 flex-shrink-0 ml-2" />
        <span className="text-xs truncate">{note.title}</span>
      </div>
    </CardContent>
  </Card>
);

interface SelectedItem {
  id: string;
  type: 'app' | 'conversation' | 'note';
}

interface ConversationSidebarProps {
  selectedItem: SelectedItem | null;
  onSelectItem: (id: string | null, type: 'app' | 'conversation' | 'note' | null) => void;
  onFileSelect: (path: string) => void;
  onOpenProfileSettings: () => void;
  onOpenAppSettings: () => void;
  onOpenServerManagement: () => void;
  onOpenUserManagement: () => void;
  onOpenDeepAiCoder: () => void;
}

export function ConversationSidebar({
  selectedItem,
  onSelectItem,
  onFileSelect,
  onOpenProfileSettings,
  onOpenAppSettings,
  onOpenServerManagement,
  onOpenUserManagement,
  onOpenDeepAiCoder,
}: ConversationSidebarProps) {
  const { isLoading: isSessionLoading } = useSession();
  const {
    apps,
    conversations,
    folders,
    notes,
    isLoading: isLoadingData,
    fetchData,
    createConversation,
    createFolder,
    createNote,
    moveItem,
  } = useSidebarData();

  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    apps: true,
    chats: true,
    notes: true,
  });

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

  const handleDrop = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;
    try {
      const { id, type } = JSON.parse(data);
      moveItem(id, type, targetFolderId);
    } catch (error) {
      toast.error('Error al mover el elemento.');
    }
  };

  const renderSection = (title: string, icon: React.ReactNode, key: keyof typeof expandedSections, items: React.ReactNode) => (
    <>
      <div className="px-2 py-1">
        <h3
          className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2 cursor-pointer"
          onClick={() => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))}
        >
          {expandedSections[key] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {icon} {title}
        </h3>
      </div>
      {expandedSections[key] && items}
    </>
  );

  return (
    <div className="flex flex-col h-full p-4 border-r bg-sidebar text-sidebar-foreground">
      <SidebarHeader
        onNewConversation={handleCreateConversation}
        onNewFolder={handleCreateFolder}
        onNewNote={handleCreateNote}
        isCreatingConversation={isCreatingConversation}
        isCreatingFolder={isCreatingFolder}
        isCreatingNote={isCreatingNote}
        onOpenProfileSettings={onOpenProfileSettings}
        onOpenAppSettings={onOpenAppSettings}
        onOpenServerManagement={onOpenServerManagement}
        onOpenUserManagement={onOpenUserManagement}
        onOpenDeepAiCoder={onOpenDeepAiCoder}
      />

      <ScrollArea className="flex-1">
        <div className="space-y-2">
          {isLoadingData ? (
            Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
          ) : (
            <>
              {renderSection("Proyectos DeepAI Coder", <Wand2 className="h-4 w-4" />, "apps",
                apps.map(app => (
                  <div key={app.id}>
                    <Card
                      className={cn("cursor-pointer hover:bg-sidebar-accent", selectedItem?.type === 'app' && selectedItem.id === app.id && "bg-sidebar-primary text-sidebar-primary-foreground")}
                      onClick={() => onSelectItem(app.id, 'app')}
                    >
                      <CardContent className="py-1 px-1.5 flex items-center gap-1"><Code className="h-3 w-3 ml-2" /><span className="text-xs truncate">{app.name}</span></CardContent>
                    </Card>
                    {selectedItem?.type === 'app' && selectedItem.id === app.id && (
                      <div className="border-l-2 border-sidebar-primary ml-2"><FileTree appId={app.id} onFileSelect={onFileSelect} /></div>
                    )}
                  </div>
                ))
              )}

              <Separator className="my-4 bg-sidebar-border" />

              {renderSection("Notas", <FileText className="h-4 w-4" />, "notes",
                notes.filter(n => !n.folder_id).map(note => (
                  <DraggableNoteItem
                    key={note.id}
                    note={note}
                    selected={selectedItem?.type === 'note' && selectedItem.id === note.id}
                    onSelect={() => onSelectItem(note.id, 'note')}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ id: note.id, type: 'note' }))}
                  />
                ))
              )}

              <Separator className="my-4 bg-sidebar-border" />

              {renderSection("Chats", <MessageSquare className="h-4 w-4" />, "chats",
                conversations.filter(c => !c.folder_id).map(conv => (
                  <DraggableConversationCard
                    key={conv.id}
                    conversation={conv}
                    selectedConversationId={selectedItem?.type === 'conversation' ? selectedItem.id : null}
                    onSelectConversation={(id) => onSelectItem(id, 'conversation')}
                    onConversationUpdated={fetchData}
                    onConversationDeleted={fetchData}
                    onConversationMoved={() => {}}
                    onConversationReordered={() => {}}
                    allFolders={[]}
                    level={0}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ id: conv.id, type: 'conversation' }))}
                    isDraggingOver={false}
                    dropPosition={null}
                  />
                ))
              )}

              <Separator className="my-4 bg-sidebar-border" />
              
              {folders.filter(f => !f.parent_id).map(folder => (
                <div key={folder.id} onDrop={(e) => handleDrop(e, folder.id)} onDragOver={(e) => e.preventDefault()}>
                  {/* Folder rendering logic will need to be updated to show notes and conversations */}
                  <Card className="p-2"><FolderIcon className="h-4 w-4 inline mr-2" />{folder.name}</Card>
                </div>
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}