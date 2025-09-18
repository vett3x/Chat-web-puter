"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, MessageSquare, Loader2, Edit, Save, X, Trash2, Folder, List, Archive, MoreVertical, MoveRight } from 'lucide-react';
import { useSession } from '@/components/session-context-provider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { ProfileDropdown } from './profile-dropdown';
import { Skeleton } from '@/components/ui/skeleton';
import { FolderItem } from './folder-item';

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

type ViewMode = 'all' | 'unarchived' | 'folder';

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
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('unarchived'); // Default view mode
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null); // Track selected folder for view mode

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

  // Re-fetch when a new conversation is created externally or moved
  useEffect(() => {
    if (userId && selectedConversationId && !isLoadingConversations) {
      const isSelectedConversationInList = conversations.some(
        (conv) => conv.id === selectedConversationId
      );
      if (!isSelectedConversationInList) {
        fetchConversationsAndFolders();
      }
    }
  }, [selectedConversationId, userId, isLoadingConversations, conversations, fetchConversationsAndFolders]);

  const createNewConversation = async () => {
    if (!userId || isCreatingConversation) return;

    setIsCreatingConversation(true);
    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: userId, title: 'Nueva conversación', folder_id: null }) // New conversations are unarchived by default
      .select('id, title, created_at, folder_id')
      .single();

    if (error) {
      console.error('Error creating new conversation:', error);
      toast.error('Error al crear una nueva conversación.');
    } else if (data) {
      setConversations(prev => [data, ...prev]);
      onSelectConversation(data.id);
      toast.success('Nueva conversación creada.');
      setViewMode('unarchived'); // Switch to unarchived view
      setSelectedFolderId(null);
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
      setViewMode('folder'); // Switch to folder view
      setSelectedFolderId(data.id); // Select the newly created folder
    }
    setIsCreatingFolder(false);
  };

  const handleEditConversationClick = (conversation: Conversation) => {
    setEditingConversationId(conversation.id);
    setEditingTitle(conversation.title);
  };

  const handleSaveConversationEdit = async (conversationId: string) => {
    if (!editingTitle.trim()) {
      toast.error('El título no puede estar vacío.');
      return;
    }
    const { error } = await supabase
      .from('conversations')
      .update({ title: editingTitle })
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating conversation title:', error);
      toast.error('Error al actualizar el título de la conversación.');
    } else {
      setConversations(prev =>
        prev.map(conv => (conv.id === conversationId ? { ...conv, title: editingTitle } : conv))
      );
      setEditingConversationId(null);
      setEditingTitle('');
      toast.success('Título de conversación actualizado.');
    }
  };

  const handleCancelConversationEdit = () => {
    setEditingConversationId(null);
    setEditingTitle('');
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!userId) {
      toast.error('Usuario no autenticado.');
      return;
    }

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Error al eliminar la conversación.');
    } else {
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      if (selectedConversationId === conversationId) {
        onSelectConversation(null);
      }
      toast.success('Conversación eliminada.');
    }
    setDeletingConversationId(null);
  };

  const handleMoveConversation = async (conversationId: string, targetFolderId: string | null) => {
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

  const handleSelectFolder = (folderId: string | null) => {
    setSelectedFolderId(folderId);
    setViewMode('folder');
    onSelectConversation(null); // Deselect any conversation when selecting a folder
  };

  const rootFolders = folders.filter(f => f.parent_id === null);
  const unarchivedConversations = conversations.filter(conv => conv.folder_id === null);

  // Si la sesión está cargando, no mostramos nada aún o un indicador global si lo hubiera
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

      <div className="flex gap-2 mb-4">
        <Button
          variant={viewMode === 'unarchived' ? 'secondary' : 'ghost'}
          className="flex-1 justify-start"
          onClick={() => { setViewMode('unarchived'); setSelectedFolderId(null); onSelectConversation(null); }}
        >
          <MessageSquare className="mr-2 h-4 w-4" /> Conversaciones
        </Button>
        <Button
          variant={viewMode === 'folder' ? 'secondary' : 'ghost'}
          className="flex-1 justify-start"
          onClick={() => { setViewMode('folder'); onSelectConversation(null); }}
        >
          <Folder className="mr-2 h-4 w-4" /> Carpetas
        </Button>
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
              {viewMode === 'unarchived' && (
                unarchivedConversations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay conversaciones sin archivar.
                  </p>
                ) : (
                  unarchivedConversations.map((conversation) => (
                    <Card
                      key={conversation.id}
                      className={cn(
                        "cursor-pointer hover:bg-sidebar-accent transition-colors group",
                        selectedConversationId === conversation.id && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary"
                      )}
                      onClick={() => onSelectConversation(conversation.id)}
                    >
                      <CardContent className="p-3 flex items-center justify-between gap-2">
                        {editingConversationId === conversation.id ? (
                          <Input
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveConversationEdit(conversation.id);
                              }
                            }}
                            className="flex-1 bg-sidebar-background text-sidebar-foreground"
                          />
                        ) : (
                          <div className="flex items-center gap-2 flex-1 overflow-hidden">
                            <MessageSquare className="h-4 w-4 flex-shrink-0" />
                            <span className="text-sm truncate">{conversation.title}</span>
                          </div>
                        )}
                        <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {editingConversationId === conversation.id ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  handleSaveConversationEdit(conversation.id);
                                }}
                                className="h-7 w-7 text-sidebar-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  handleCancelConversationEdit();
                                }}
                                className="h-7 w-7 text-sidebar-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  handleEditConversationClick(conversation);
                                }}
                                className={cn(
                                  "h-7 w-7",
                                  selectedConversationId === conversation.id ? "text-sidebar-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                )}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 bg-popover text-popover-foreground border-border">
                                  <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onSelectConversation(conversation.id); }}>
                                    <MessageSquare className="mr-2 h-4 w-4" /> Abrir
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuTrigger asChild>
                                    <DropdownMenuItem onSelect={(e: Event) => e.preventDefault()}>
                                      <MoveRight className="mr-2 h-4 w-4" /> Mover a
                                    </DropdownMenuItem>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent side="right" align="start" className="w-48 bg-popover text-popover-foreground border-border">
                                    <DropdownMenuLabel>Mover a Carpeta</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleMoveConversation(conversation.id, null)}>
                                      (Sin carpeta)
                                    </DropdownMenuItem>
                                    {folders.map(f => (
                                      <DropdownMenuItem key={f.id} onClick={() => handleMoveConversation(conversation.id, f.id)}>
                                        {f.name}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                  <DropdownMenuSeparator />
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e: React.MouseEvent) => {
                                          e.stopPropagation();
                                          setDeletingConversationId(conversation.id);
                                        }}
                                        className={cn(
                                          "h-7 w-7 text-destructive hover:bg-destructive/10",
                                          selectedConversationId === conversation.id ? "text-sidebar-primary-foreground hover:bg-sidebar-accent hover:text-destructive" : "text-destructive hover:bg-destructive/10"
                                        )}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Esta acción no se puede deshacer. Esto eliminará permanentemente tu conversación y todos sus mensajes.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => setDeletingConversationId(null)}>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteConversation(conversation.id)}>
                                          Eliminar
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )
              )}

              {viewMode === 'folder' && (
                rootFolders.length === 0 && folders.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay carpetas. ¡Crea una nueva!
                  </p>
                ) : (
                  rootFolders.map((folder) => (
                    <FolderItem
                      key={folder.id}
                      folder={folder}
                      level={0}
                      selectedConversationId={selectedConversationId}
                      onSelectConversation={onSelectConversation}
                      onSelectFolder={handleSelectFolder}
                      conversations={conversations}
                      subfolders={folders}
                      onFolderUpdated={fetchConversationsAndFolders}
                      onFolderDeleted={fetchConversationsAndFolders}
                      onConversationMoved={handleMoveConversation}
                      onCreateSubfolder={createNewFolder}
                      allFolders={folders}
                    />
                  ))
                )
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