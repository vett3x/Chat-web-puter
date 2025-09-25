"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
import { FileText, Edit, Save, X, Trash2, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './session-context-provider';

interface Note {
  id: string;
  title: string;
}

interface DraggableNoteItemProps {
  note: Note;
  selected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent) => void;
  level: number;
  onNoteUpdated: (id: string, updatedData: Partial<Note>) => void; // Changed prop
  onNoteDeleted: (id: string) => void; // Changed prop
}

export function DraggableNoteItem({ note, selected, onSelect, onDragStart, level, onNoteUpdated, onNoteDeleted }: DraggableNoteItemProps) {
  const { session } = useSession();
  const userId = session?.user?.id;
  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(note.title);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSaveEdit = async () => {
    if (!editingTitle.trim()) {
      toast.error('El título no puede estar vacío.');
      return;
    }
    if (editingTitle === note.title) {
      setIsEditing(false);
      return;
    }

    const { error } = await supabase
      .from('notes')
      .update({ title: editingTitle })
      .eq('id', note.id)
      .eq('user_id', userId);

    if (error) {
      toast.error('Error al actualizar el título de la nota.');
    } else {
      toast.success('Título de la nota actualizado.');
      onNoteUpdated(note.id, { title: editingTitle }); // Use new prop
      setIsEditing(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!userId) return;

    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', note.id)
      .eq('user_id', userId);

    if (error) {
      toast.error('Error al eliminar la nota.');
    } else {
      toast.success('Nota eliminada.');
      onNoteDeleted(note.id); // Use new prop
    }
    setIsDeleting(false);
  };

  const paddingLeft = `${level * 1.25 + 0.5}rem`;

  return (
    <div
      className={cn(
        "cursor-pointer hover:bg-sidebar-accent transition-colors group relative rounded-md flex items-center justify-between gap-1 py-1 px-1.5"
      )}
      onClick={onSelect}
      draggable="true"
      onDragStart={onDragStart}
      style={{ paddingLeft }}
    >
      {isEditing ? (
        <Input
          ref={inputRef}
          value={editingTitle}
          onChange={(e) => setEditingTitle(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
          onBlur={handleSaveEdit}
          className="flex-1 bg-sidebar-background text-sidebar-foreground h-6 text-xs"
        />
      ) : (
        <div className="flex items-center gap-1 flex-1 overflow-hidden">
          <FileText className="h-3 w-3 flex-shrink-0" />
          <div className="truncate">
            <span className={cn(
              "text-xs relative",
              selected && "selected-indicator"
            )}>
              {note.title}
            </span>
          </div>
        </div>
      )}
      <div className="flex-shrink-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {isEditing ? (
          <>
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleSaveEdit(); }} className="h-5 w-5">
              <Save className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setIsEditing(false); setEditingTitle(note.title); }} className="h-5 w-5">
              <X className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-popover text-popover-foreground border-border">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSelect(); }}>
                <FileText className="mr-2 h-4 w-4" /> Abrir
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}>
                <Edit className="mr-2 h-4 w-4" /> Renombrar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. Esto eliminará permanentemente tu nota.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={(e) => { e.stopPropagation(); handleDeleteNote(); }}>
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}