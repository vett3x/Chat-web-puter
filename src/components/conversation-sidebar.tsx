"use client";

import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSession } from '@/components/session-context-provider';
import { Loader2, MessageSquare, ChevronRight, ChevronDown } from 'lucide-react';
import { SidebarHeader } from './sidebar-header';
import { useConversations } from '@/hooks/use-conversations';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { DraggableFolderItem } from './draggable-folder-item';
import { DraggableConversationCard } from './draggable-conversation-card';
import { toast } from 'sonner';

interface ConversationSidebarProps {
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string | null) => void;
  onOpenProfileSettings: () => void;
  onOpenAppSettings: () => void;
  onOpenServerManagement: () => void;
  onOpenUserManagement: () => void;
  onOpenDeepAiCoder: () => void;
}

export function ConversationSidebar({
  selectedConversationId,
  onSelectConversation,
  onOpenProfileSettings,
  onOpenAppSettings,
  onOpenServerManagement,
  onOpenUserManagement,
  onOpenDeepAiCoder,
}: ConversationSidebarProps) {
  const { isLoading: isSessionLoading } = useSession();
  const {
    conversations,
    folders,
    isLoading: isLoadingData,
    fetchData,
    createConversation,
    createFolder,
    moveConversation,
    reorderConversation,
    moveFolder,
  } = useConversations();

  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isGeneralExpanded, setIsGeneralExpanded] = useState(true);

  // Drag and Drop State
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [draggedItemType, setDraggedItemType] = useState<'conversation' | 'folder' | null>(null);
  const [draggingOverFolderId, setDraggingOverFolderId] = useState<string | null>(null);
  const [draggedOverConversationId, setDraggedOverConversationId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);

  const handleCreateConversation = async () => {
    setIsCreatingConversation(true);
    await createConversation((newConversation) => {
      onSelectConversation(newConversation.id);
      setIsGeneralExpanded(true);
    });
    setIsCreatingConversation(false);
  };

  const handleCreateFolder = async (parentId: string | null = null) => {
    setIsCreatingFolder(true);
    await createFolder(parentId);
    setIsCreatingFolder(false);
  };

  const handleDragStart = (e: React.DragEvent, id: string, type: 'conversation' | 'folder') => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id, type }));
    setDraggedItemId(id);
    setDraggedItemType(type);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
    setDraggedItemType(null);
    setDraggingOverFolderId(null);
    setDraggedOverConversationId(null);
    setDropPosition(null);
  };

  const handleDrop = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOverFolderId(null);

    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;

    try {
      const { id, type } = JSON.parse(data);
      if (type === 'conversation') {
        moveConversation(id, targetFolderId).then(() => {
          if (selectedConversationId === id) onSelectConversation(null);
        });
      } else if (type === 'folder') {
        if (id === targetFolderId) return;
        moveFolder(id, targetFolderId);
      }
    } catch (error) {
      console.error('Error parsing drag data:', error);
      toast.error('Error al procesar el arrastre.');
    }
  };

  const handleDragEnterFolder = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOverFolderId(folderId);
  };

  const handleDragLeaveFolder = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOverFolderId(null);
  };

  const rootFolders = folders.filter(f => f.parent_id === null);
  const generalConversations = conversations.filter(conv => conv.folder_id === null);

  if (isSessionLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Cargando sesión...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 border-r bg-sidebar text-sidebar-foreground" onDragEnd={handleDragEnd}>
      <SidebarHeader
        onNewConversation={handleCreateConversation}
        onNewFolder={handleCreateFolder}
        isCreatingConversation={isCreatingConversation}
        isCreatingFolder={isCreatingFolder}
        onOpenProfileSettings={onOpenProfileSettings}
        onOpenAppSettings={onOpenAppSettings}
        onOpenServerManagement={onOpenServerManagement}
        onOpenUserManagement={onOpenUserManagement}
        onOpenDeepAiCoder={onOpenDeepAiCoder}
      />

      <ScrollArea className="flex-1">
        <div className="space-y-2">
          {isLoadingData ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-3 flex items-center gap-2 bg-sidebar-accent">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 w-3/4" />
              </Card>
            ))
          ) : (
            <>
              <Card
                className={cn(
                  "cursor-pointer hover:bg-sidebar-accent transition-colors group relative",
                  draggingOverFolderId === null && draggedItemType === 'conversation' && "border-2 border-blue-500 bg-blue-500/10"
                )}
                onClick={() => setIsGeneralExpanded(!isGeneralExpanded)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, null)}
                onDragEnter={(e) => handleDragEnterFolder(e, null)}
                onDragLeave={handleDragLeaveFolder}
              >
                <CardContent className="py-1.5 px-2 flex items-center justify-between gap-1">
                  <div className="flex items-center flex-1 overflow-hidden">
                    <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0">
                      {isGeneralExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </Button>
                    <MessageSquare className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                    <span className="text-sm font-medium truncate flex-1">General</span>
                  </div>
                </CardContent>
              </Card>

              {isGeneralExpanded && (
                <div className="pl-4 space-y-1">
                  {generalConversations.map((conversation) => (
                    <DraggableConversationCard
                      key={conversation.id}
                      conversation={conversation}
                      selectedConversationId={selectedConversationId}
                      onSelectConversation={onSelectConversation}
                      onConversationUpdated={fetchData}
                      onConversationDeleted={fetchData}
                      onConversationMoved={moveConversation}
                      onConversationReordered={reorderConversation}
                      allFolders={folders}
                      level={0}
                      onDragStart={handleDragStart}
                      isDraggingOver={draggedOverConversationId === conversation.id && draggedItemType === 'conversation'}
                      dropPosition={draggedOverConversationId === conversation.id ? dropPosition : null}
                    />
                  ))}
                </div>
              )}

              <Separator className="my-4 bg-sidebar-border" />

              {rootFolders.map((folder) => (
                <DraggableFolderItem
                  key={folder.id}
                  folder={folder}
                  level={0}
                  selectedConversationId={selectedConversationId}
                  onSelectConversation={onSelectConversation}
                  onSelectFolder={() => onSelectConversation(null)}
                  conversations={conversations}
                  subfolders={folders}
                  onFolderUpdated={fetchData}
                  onFolderDeleted={fetchData}
                  onConversationMoved={moveConversation}
                  onFolderMoved={moveFolder}
                  onCreateSubfolder={handleCreateFolder}
                  allFolders={folders}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  isDraggingOver={draggingOverFolderId === folder.id}
                  onDragEnter={handleDragEnterFolder}
                  onDragLeave={handleDragLeaveFolder}
                  onConversationReordered={reorderConversation}
                  draggedOverConversationId={draggedOverConversationId}
                  dropPosition={dropPosition}
                  draggedItemType={draggedItemType}
                />
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}