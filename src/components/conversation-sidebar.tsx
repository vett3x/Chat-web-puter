"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, MessageSquare, Loader2, Folder, ChevronRight, ChevronDown } from 'lucide-react';
import { Separator } from '@/components/ui/separator'; // Corrected import
import { useSession } from '@/components/session-context-provider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ProfileDropdown } from './profile-dropdown';
import { Skeleton } from '@/components/ui/skeleton';
import { DraggableFolderItem } from './draggable-folder-item';
import { DraggableConversationCard } from './draggable-conversation-card';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  folder_id: string | null;
}

interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  user_id: string;
}

interface ConversationSidebarProps {
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string | null) => void;
}

export function ConversationSidebar({
  selectedConversationId,
  onSelectConversation,
}: ConversationSidebarProps) {
  const { session, isLoading: isSessionLoading } = useSession();
  const userId = session?.user?.id;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isGeneralExpanded, setIsGeneralExpanded] = useState(true);

  // Drag and Drop State
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [draggedItemType, setDraggedItemType] = useState<'conversation' | 'folder' | null>(null);
  const [draggingOverFolderId, setDraggingOverFolderId] = useState<string | null>(null);

  const fetchConversationsAndFolders = useCallback(async () => {
    if (!userId) {
      setConversations([]);
      setFolders([]);
      setIsLoadingConversations(false);
      return;
    }

    setIsLoadingConversations(true);
    const { data: convData, error: convError } = await supabase
      .from('conversations')
      .select('id, title, created_at, folder_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const { data: folderData, error: folderError } = await supabase
      .from('folders')
      .select('id, name, parent_id, created_at, user_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (convError) {
      console.error('Error fetching conversations:', convError);
      toast.error('Error al cargar las conversaciones.');
    } else {
      setConversations(convData || []);
    }

    if (folderError) {
      console.error('Error fetching folders:', folderError);
      toast.error('Error al cargar las carpetas.');
    } else {
      setFolders(folderData || []);
    }
    setIsLoadingConversations(false);
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchConversationsAndFolders();
    } else if (!isSessionLoading) {
      setConversations([]);
      setFolders([]);
      setIsLoadingConversations(false);
    }
  }, [userId, isSessionLoading, fetchConversationsAndFolders]);

  const createNewConversation = async () => {
    if (!userId || isCreatingConversation) return;

    setIsCreatingConversation(true);
    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: userId, title: 'Nueva conversación', folder_id: null })
      .select('id, title, created_at, folder_id')
      .single();

    if (error) {
      console.error('Error creating new conversation:', error);
      toast.error('Error al crear una nueva conversación.');
    } else if (data) {
      setConversations(prev => [data, ...prev]);
      onSelectConversation(data.id);
      toast.success('Nueva conversación creada.');
      setIsGeneralExpanded(true); // Ensure General is expanded for new conversation
    }
    setIsCreatingConversation(false);
  };

  const createNewFolder = async (parentId: string | null = null) => {
    if (!userId || isCreatingFolder) return;

    setIsCreatingFolder(true);
    const newFolderName = parentId ? 'Nueva subcarpeta' : 'Nueva carpeta';
    const { data, error } = await supabase
      .from('folders')
      .insert({ user_id: userId, name: newFolderName, parent_id: parentId })
      .select('id, name, parent_id, created_at, user_id')
      .single();

    if (error) {
      console.error('Error creating new folder:', error);
      toast.error('Error al crear una nueva carpeta.');
    } else if (data) {
      setFolders(prev => [data, ...prev]);
      toast.success(`${newFolderName} creada.`);
    }
    setIsCreatingFolder(false);
  };

  const handleConversationMoved = async (conversationId: string, targetFolderId: string | null) => {
    if (!userId) {
      toast.error('Usuario no autenticado.');
      return;
    }

    const { error } = await supabase
      .from('conversations')
      .update({ folder_id: targetFolderId })
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error moving conversation:', error);
      toast.error('Error al mover la conversación.');
    } else {
      toast.success('Conversación movida.');
      fetchConversationsAndFolders(); // Re-fetch to update both lists
      if (selectedConversationId === conversationId) {
        onSelectConversation(null); // Deselect if the moved conversation was selected
      }
    }
  };

  const handleFolderMoved = async (folderId: string, targetParentId: string | null) => {
    if (!userId) {
      toast.error('Usuario no autenticado.');
      return;
    }

    const { error } = await supabase
      .from('folders')
      .update({ parent_id: targetParentId })
      .eq('id', folderId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error moving folder:', error);
      toast.error('Error al mover la carpeta.');
    } else {
      toast.success('Carpeta movida.');
      fetchConversationsAndFolders(); // Re-fetch to update both lists
    }
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
  };

  const handleDrop = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    setDraggingOverFolderId(null); // Reset drag over state

    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;

    try {
      const { id, type } = JSON.parse(data);

      if (type === 'conversation') {
        handleConversationMoved(id, targetFolderId);
      } else if (type === 'folder') {
        // Prevent dropping a folder into itself or its direct child
        if (id === targetFolderId) {
          toast.error('No puedes mover una carpeta a sí misma.');
          return;
        }
        // Check if targetFolderId is a descendant of id
        let currentParentId = targetFolderId;
        while (currentParentId) {
          if (currentParentId === id) {
            toast.error('No puedes mover una carpeta a una de sus subcarpetas.');
            return;
          }
          const parentFolder = folders.find(f => f.id === currentParentId);
          currentParentId = parentFolder ? parentFolder.parent_id : null;
        }
        handleFolderMoved(id, targetFolderId);
      }
    } catch (error) {
      console.error('Error parsing drag data:', error);
      toast.error('Error al procesar el arrastre.');
    }
  };

  const handleDragEnter = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    setDraggingOverFolderId(folderId);
  };

  const handleDragLeave = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    if (draggingOverFolderId === folderId) {
      setDraggingOverFolderId(null);
    }
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
    <div className="flex flex-col h-full p-4 border-r bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Navegación</h2>
        <div className="flex gap-2">
          <Button
            variant="default"
            size="icon"
            onClick={createNewConversation}
            disabled={isCreatingConversation}
            className="bg-green-500 hover:bg-green-600 text-white animate-pulse-glow rounded-full"
            title="Nueva conversación"
          >
            {isCreatingConversation ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => createNewFolder()}
            disabled={isCreatingFolder}
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-full"
            title="Nueva carpeta"
          >
            {isCreatingFolder ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Folder className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-2">
          {isLoadingConversations && conversations.length === 0 && folders.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-3 flex items-center gap-2 bg-sidebar-accent">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 w-3/4" />
              </Card>
            ))
          ) : (
            <>
              {/* General Conversations Section */}
              <Card
                className={cn(
                  "cursor-pointer hover:bg-sidebar-accent transition-colors group relative",
                  selectedConversationId === null && isGeneralExpanded && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary",
                  draggingOverFolderId === null && draggedItemType === 'conversation' && "border-2 border-blue-500 bg-blue-500/10" // Visual feedback for drag over General
                )}
                onClick={() => setIsGeneralExpanded(!isGeneralExpanded)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, null)} // Drop target for 'General' (null folder_id)
                onDragEnter={(e) => handleDragEnter(e, null)}
                onDragLeave={(e) => handleDragLeave(e, null)}
              >
                <CardContent className="p-2 flex items-center justify-between gap-2">
                  <div className="flex items-center flex-1 overflow-hidden">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 flex-shrink-0"
                      onClick={(e: React.MouseEvent) => { e.stopPropagation(); setIsGeneralExpanded(!isGeneralExpanded); }}
                    >
                      {isGeneralExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                    <MessageSquare className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="text-sm font-medium truncate flex-1">General</span>
                  </div>
                </CardContent>
              </Card>

              {isGeneralExpanded && (
                <div className="pl-4 space-y-1">
                  {generalConversations.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      No hay conversaciones en General.
                    </p>
                  ) : (
                    generalConversations.map((conversation) => (
                      <DraggableConversationCard
                        key={conversation.id}
                        conversation={conversation}
                        selectedConversationId={selectedConversationId}
                        onSelectConversation={onSelectConversation}
                        onConversationUpdated={fetchConversationsAndFolders}
                        onConversationDeleted={fetchConversationsAndFolders}
                        onConversationMoved={handleConversationMoved}
                        allFolders={folders}
                        level={1} // Indent for conversations in General
                        onDragStart={handleDragStart}
                      />
                    ))
                  )}
                </div>
              )}

              <Separator className="my-4 bg-sidebar-border" />

              {/* Folders Section */}
              {rootFolders.length === 0 && generalConversations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay carpetas. ¡Crea una nueva!
                </p>
              ) : (
                rootFolders.map((folder) => (
                  <DraggableFolderItem
                    key={folder.id}
                    folder={folder}
                    level={0}
                    selectedConversationId={selectedConversationId}
                    onSelectConversation={onSelectConversation}
                    onSelectFolder={() => onSelectConversation(null)} // Deselect conversation when selecting folder
                    conversations={conversations}
                    subfolders={folders}
                    onFolderUpdated={fetchConversationsAndFolders}
                    onFolderDeleted={fetchConversationsAndFolders}
                    onConversationMoved={handleConversationMoved}
                    onFolderMoved={handleFolderMoved}
                    onCreateSubfolder={createNewFolder}
                    allFolders={folders}
                    onDragStart={handleDragStart}
                    onDrop={handleDrop}
                    isDraggingOver={draggingOverFolderId === folder.id}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                  />
                ))
              )}
            </>
          )}
        </div>
      </ScrollArea>
      <div className="mt-auto pt-4 border-t border-sidebar-border">
        <ProfileDropdown />
      </div>
    </div>
  );
}