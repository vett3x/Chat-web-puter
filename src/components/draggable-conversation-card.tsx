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
import { MessageSquare, Edit, Save, X, Trash2, MoreVertical, MoveRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './session-context-provider';

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

interface DraggableConversationCardProps {
  conversation: Conversation;
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string | null) => void;
  onConversationUpdated: () => void;
  onConversationDeleted: () => void;
  onConversationMoved: (conversationId: string, targetFolderId: string | null) => void;
  allFolders: Folder[];
  level: number; // For indentation
  onDragStart: (e: React.DragEvent, conversationId: string, type: 'conversation' | 'folder') => void;
}

export function DraggableConversationCard({
  conversation,
  selectedConversationId,
  onSelectConversation,
  onConversationUpdated,
  onConversationDeleted,
  onConversationMoved,
  allFolders,
  level,
  onDragStart,
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
      onConversationUpdated();
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
      onConversationDeleted();
      if (selectedConversationId === conversation.id) {
        onSelectConversation(null);
      }
    }
    setIsDeleting(false);
  };

  const paddingLeft = `${level * 1.25 + 0.5}rem`; // Indent based on level

  return (
    <Card
      className={cn(
        "cursor-pointer hover:bg-sidebar-accent transition-colors group relative",
        selectedConversationId === conversation.id && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary"
      )}
      onClick={() => onSelectConversation(conversation.id)}
      style={{ paddingLeft: paddingLeft }}
      draggable="true"
      onDragStart={(e) => onDragStart(e, conversation.id, 'conversation')}
    >
      <CardContent className="p-2 flex items-center justify-between gap-2">
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
            className="flex-1 bg-sidebar-background text-sidebar-foreground h-8"
          />
        ) : (
          <div className="flex items-center gap-2 flex-1 overflow-hidden">
            <MessageSquare className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm truncate">{conversation.title}</span>
          </div>
        )}
        <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isEditing ? (
            <>
              <Button variant="ghost" size="icon" onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleSaveEdit(); }} className="h-7 w-7">
                <Save className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={(e: React.MouseEvent) => { e.stopPropagation(); setIsEditing(false); setEditingTitle(conversation.title); }} className="h-7 w-7">
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
                <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onSelectConversation(conversation.id); }}>
                  <MessageSquare className="mr-2 h-4 w-4" /> Abrir
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
                  <DropdownMenuItem onClick={() => onConversationMoved(conversation.id, null)}>
                    (General)
                  </DropdownMenuItem>
                  {allFolders.filter(f => f.id !== conversation.folder_id).map(f => (
                    <DropdownMenuItem key={f.id} onClick={() => onConversationMoved(conversation.id, f.id)}>
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