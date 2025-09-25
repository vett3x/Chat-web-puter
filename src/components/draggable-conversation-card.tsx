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
import { MessageSquare, Edit, Save, X, Trash2, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './session-context-provider';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  folder_id: string | null;
  order_index: number; // Added for reordering
}

interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  user_id: string;
}

interface DraggableConversationCardProps {
  conversation: Conversation;
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string | null) => void;
  onConversationUpdated: (id: string, updatedData: Partial<Conversation>) => void; // Changed prop
  onConversationDeleted: (id: string) => void; // Changed prop
  onConversationMoved: (conversationId: string, targetFolderId: string | null) => void;
  onConversationReordered: (draggedId: string, targetId: string, position: 'before' | 'after') => void; // New prop for reordering
  allFolders: Folder[];
  level: number; // For indentation
  onDragStart: (e: React.DragEvent, conversationId: string, type: 'conversation' | 'folder') => void;
  isDraggingOver: boolean; // New prop for visual feedback during reorder
  dropPosition: 'before' | 'after' | null; // New prop for visual feedback during reorder
}

export function DraggableConversationCard({
  conversation,
  selectedConversationId,
  onSelectConversation,
  onConversationUpdated,
  onConversationDeleted,
  onConversationMoved,
  onConversationReordered,
  allFolders,
  level,
  onDragStart,
  isDraggingOver,
  dropPosition,
}: DraggableConversationCardProps) {
  const { session } = useSession();
  const userId = session?.user?.id;
  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(conversation.title);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSaveEdit = async () => {
    if (!editingTitle.trim()) {
      toast.error('El título no puede estar vacío.');
      return;
    }
    if (editingTitle === conversation.title) {
      setIsEditing(false);
      return;
    }

    const { error } = await supabase
      .from('conversations')
      .update({ title: editingTitle })
      .eq('id', conversation.id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating conversation title:', error);
      toast.error('Error al actualizar el título de la conversación.');
    } else {
      toast.success('Título de conversación actualizado.');
      onConversationUpdated(conversation.id, { title: editingTitle }); // Use new prop
      setIsEditing(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!userId) {
      toast.error('Usuario no autenticado.');
      return;
    }

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversation.id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Error al eliminar la conversación.');
    } else {
      toast.success('Conversación eliminada.');
      onConversationDeleted(conversation.id); // Use new prop
      if (selectedConversationId === conversation.id) {
        onSelectConversation(null);
      }
    }
    setIsDeleting(false);
  };

  const paddingLeft = `${level * 1.25 + 0.5}rem`; // Indent based on level

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (y < rect.height / 2) {
      e.currentTarget.setAttribute('data-drop-position', 'before');
    } else {
      e.currentTarget.setAttribute('data-drop-position', 'after');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.removeAttribute('data-drop-position');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.removeAttribute('data-drop-position');
    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;

    try {
      const { id: draggedId, type: draggedType } = JSON.parse(data);
      if (draggedType === 'conversation' && draggedId !== conversation.id) {
        const dropPosition = e.currentTarget.getAttribute('data-drop-position') as 'before' | 'after';
        if (dropPosition) {
          onConversationReordered(draggedId, conversation.id, dropPosition);
        }
      }
    } catch (error) {
      console.error('Error parsing drag data:', error);
      toast.error('Error al procesar el arrastre.');
    }
  };

  return (
    <Card
      className={cn(
        "cursor-pointer hover:bg-sidebar-accent transition-colors group relative",
        selectedConversationId === conversation.id && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary",
        isDraggingOver && dropPosition === 'before' && "border-t-2 border-blue-500",
        isDraggingOver && dropPosition === 'after' && "border-b-2 border-blue-500"
      )}
      onClick={() => onSelectConversation(conversation.id)}
      style={{ paddingLeft: paddingLeft }}
      draggable="true"
      onDragStart={(e) => onDragStart(e, conversation.id, 'conversation')}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardContent className="py-1 px-1.5 flex items-center justify-between gap-1"> {/* Reduced vertical padding, adjusted horizontal */}
        {isEditing ? (
          <Input
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSaveEdit();
              }
            }}
            onBlur={handleSaveEdit}
            className="flex-1 bg-sidebar-background text-sidebar-foreground h-6 text-xs" // Reduced height
          />
        ) : (
          <div className="flex items-center gap-1 flex-1 overflow-hidden"> {/* Reduced gap */}
            <MessageSquare className="h-3 w-3 flex-shrink-0" /> {/* Smaller icon */}
            <span className="text-xs truncate">{conversation.title}</span> {/* Smaller font size */}
          </div>
        )}
        <div className="flex-shrink-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"> {/* Reduced gap */}
          {isEditing ? (
            <>
              <Button variant="ghost" size="icon" onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleSaveEdit(); }} className="h-5 w-5"> {/* Smaller buttons */}
                <Save className="h-3 w-3" /> {/* Smaller icon */}
              </Button>
              <Button variant="ghost" size="icon" onClick={(e: React.MouseEvent) => { e.stopPropagation(); setIsEditing(false); setEditingTitle(conversation.title); }} className="h-5 w-5"> {/* Smaller buttons */}
                <X className="h-3 w-3" /> {/* Smaller icon */}
              </Button>
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5"> {/* Smaller button */}
                  <MoreVertical className="h-3 w-3" /> {/* Smaller icon */}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-popover text-popover-foreground border-border">
                <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onSelectConversation(conversation.id); }}>
                  <MessageSquare className="mr-2 h-4 w-4" /> Abrir
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); setIsEditing(true); }}>
                  <Edit className="mr-2 h-4 w-4" /> Renombrar
                </DropdownMenuItem>
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
                        Esta acción no se puede deshacer. Esto eliminará permanentemente tu conversación y todos sus mensajes.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDeleteConversation(); }}>
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
  );
}