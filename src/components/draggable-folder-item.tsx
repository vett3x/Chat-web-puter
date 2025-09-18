"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
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
import { Folder, ChevronRight, ChevronDown, Edit, Save, X, Trash2, Plus, MessageSquare, MoreVertical, MoveRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './session-context-provider';
import { DraggableConversationCard } from './draggable-conversation-card'; // Import the new component

interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  user_id: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  folder_id: string | null;
}

interface DraggableFolderItemProps {
  folder: Folder;
  level: number;
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string | null) => void;
  onSelectFolder: (folderId: string | null) => void;
  conversations: Conversation[]; // All conversations, filtered by folder_id inside
  subfolders: Folder[]; // All folders, filtered by parent_id inside
  onFolderUpdated: () => void; // Callback to refresh parent list
  onFolderDeleted: () => void; // Callback to refresh parent list
  onConversationMoved: (conversationId: string, targetFolderId: string | null) => void; // Centralized callback
  onFolderMoved: (folderId: string, targetParentId: string | null) => void; // New callback for folder moves
  onCreateSubfolder: (parentId: string) => void;
  allFolders: Folder[]; // For "move to folder" dropdown
  onDragStart: (e: React.DragEvent, id: string, type: 'conversation' | 'folder') => void;
  onDrop: (e: React.DragEvent, targetFolderId: string | null) => void;
  isDraggingOver: boolean;
  onDragEnter: (e: React.DragEvent, folderId: string | null) => void;
  onDragLeave: (e: React.DragEvent, folderId: string | null) => void;
}

export function DraggableFolderItem({
  folder,
  level,
  selectedConversationId,
  onSelectConversation,
  onSelectFolder,
  conversations,
  subfolders,
  onFolderUpdated,
  onFolderDeleted,
  onConversationMoved,
  onFolderMoved, // New prop
  onCreateSubfolder,
  allFolders,
  onDragStart,
  onDrop,
  isDraggingOver,
  onDragEnter,
  onDragLeave,
}: DraggableFolderItemProps) {
  const { session } = useSession();
  const userId = session?.user?.id;
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState(folder.name);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredConversations = conversations.filter(conv => conv.folder_id === folder.id);
  const filteredSubfolders = subfolders.filter(sub => sub.parent_id === folder.id);

  const handleSaveEdit = async () => {
    if (!editingName.trim()) {
      toast.error('El nombre de la carpeta no puede estar vacío.');
      return;
    }
    if (editingName === folder.name) {
      setIsEditing(false);
      return;
    }

    const { error } = await supabase
      .from('folders')
      .update({ name: editingName })
      .eq('id', folder.id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating folder name:', error);
      toast.error('Error al actualizar el nombre de la carpeta.');
    } else {
      toast.success('Nombre de carpeta actualizado.');
      onFolderUpdated();
      setIsEditing(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!userId) {
      toast.error('Usuario no autenticado.');
      return;
    }

    // Check if folder contains subfolders or conversations
    if (filteredSubfolders.length > 0 || filteredConversations.length > 0) {
      toast.error('No se puede eliminar una carpeta que contiene elementos. Vacíala primero.');
      setIsDeleting(false);
      return;
    }

    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', folder.id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting folder:', error);
      toast.error('Error al eliminar la carpeta.');
    } else {
      toast.success('Carpeta eliminada.');
      onFolderDeleted();
      // If the selected conversation was in this folder, deselect it
      if (selectedConversationId && filteredConversations.some(conv => conv.id === selectedConversationId)) {
        onSelectConversation(null);
      }
      // If the selected folder was this one, deselect it
      onSelectFolder(null);
    }
    setIsDeleting(false);
  };

  const paddingLeft = `${level * 1.25 + 0.5}rem`; // Indent based on level

  return (
    <div className="space-y-1">
      <Card
        className={cn(
          "cursor-pointer hover:bg-sidebar-accent transition-colors group relative",
          selectedConversationId === null && isExpanded && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary",
          isDraggingOver && "border-2 border-blue-500 bg-blue-500/10" // Visual feedback for drag over
        )}
        style={{ paddingLeft: paddingLeft }}
        draggable="true"
        onDragStart={(e) => onDragStart(e, folder.id, 'folder')}
        onDragOver={(e) => e.preventDefault()} // Allow drop
        onDrop={(e) => onDrop(e, folder.id)}
        onDragEnter={(e) => onDragEnter(e, folder.id)}
        onDragLeave={(e) => onDragLeave(e, folder.id)}
      >
        <CardContent className="p-2 flex items-center justify-between gap-2">
          <div className="flex items-center flex-1 overflow-hidden" onClick={() => setIsExpanded(!isExpanded)}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            <Folder className="h-4 w-4 mr-2 flex-shrink-0" />
            {isEditing ? (
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveEdit();
                  }
                }}
                onBlur={handleSaveEdit}
                className="flex-1 bg-sidebar-background text-sidebar-foreground h-8"
              />
            ) : (
              <span className="text-sm font-medium truncate flex-1" onClick={() => onSelectFolder(folder.id)}>
                {folder.name}
              </span>
            )}
          </div>
          <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isEditing ? (
              <>
                <Button variant="ghost" size="icon" onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleSaveEdit(); }} className="h-7 w-7">
                  <Save className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={(e: React.MouseEvent) => { e.stopPropagation(); setIsEditing(false); setEditingName(folder.name); }} className="h-7 w-7">
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-popover text-popover-foreground border-border">
                  <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onCreateSubfolder(folder.id); }}>
                    <Plus className="mr-2 h-4 w-4" /> Crear Subcarpeta
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); setIsEditing(true); }}>
                    <Edit className="mr-2 h-4 w-4" /> Renombrar
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
                    <DropdownMenuItem onClick={() => onFolderMoved(folder.id, null)}>
                      (Raíz)
                    </DropdownMenuItem>
                    {allFolders.filter(f => f.id !== folder.id && f.id !== folder.parent_id).map(f => (
                      <DropdownMenuItem key={f.id} onClick={() => onFolderMoved(folder.id, f.id)}>
                        {f.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                  <DropdownMenuSeparator />
                  <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e: Event) => e.preventDefault()} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción no se puede deshacer. Esto eliminará permanentemente la carpeta.
                          Asegúrate de que no contiene subcarpetas ni conversaciones.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDeleteFolder(); }}>
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardContent>
      </Card>

      {isExpanded && (
        <div className="space-y-1">
          {filteredSubfolders.map((subfolder) => (
            <DraggableFolderItem
              key={subfolder.id}
              folder={subfolder}
              level={level + 1}
              selectedConversationId={selectedConversationId}
              onSelectConversation={onSelectConversation}
              onSelectFolder={onSelectFolder}
              conversations={conversations}
              subfolders={subfolders}
              onFolderUpdated={onFolderUpdated}
              onFolderDeleted={onFolderDeleted}
              onConversationMoved={onConversationMoved}
              onFolderMoved={onFolderMoved}
              onCreateSubfolder={onCreateSubfolder}
              allFolders={allFolders}
              onDragStart={onDragStart}
              onDrop={onDrop}
              isDraggingOver={false} // Pass false for nested items
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
            />
          ))}
          {filteredConversations.map((conversation) => (
            <DraggableConversationCard
              key={conversation.id}
              conversation={conversation}
              selectedConversationId={selectedConversationId}
              onSelectConversation={onSelectConversation}
              onConversationUpdated={onFolderUpdated} // Re-fetch all on update
              onConversationDeleted={onFolderUpdated} // Re-fetch all on delete
              onConversationMoved={onConversationMoved}
              allFolders={allFolders}
              level={level + 1}
              onDragStart={onDragStart}
            />
          ))}
        </div>
      )}
    </div>
  );
}