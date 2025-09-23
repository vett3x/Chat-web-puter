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
import { Folder, ChevronRight, ChevronDown, Edit, Save, X, Trash2, Plus, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './session-context-provider';
import { DraggableConversationCard } from './draggable-conversation-card';
import { DraggableNoteItem } from './draggable-note-item'; // Import the new component

interface Item {
  id: string;
  type: 'conversation' | 'note' | 'folder' | 'app';
}

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
  order_index: number;
}

interface Note {
  id: string;
  title: string;
  folder_id: string | null;
}

interface DraggableFolderItemProps {
  folder: Folder;
  level: number;
  selectedItem: Item | null;
  onSelectItem: (id: string, type: Item['type']) => void;
  conversations: Conversation[];
  notes: Note[]; // Add notes prop
  subfolders: Folder[];
  onFolderUpdated: () => void;
  onFolderDeleted: () => void;
  onItemMoved: (itemId: string, itemType: 'conversation' | 'note' | 'folder', targetFolderId: string | null) => void;
  onCreateSubfolder: (parentId: string) => void;
  onDragStart: (e: React.DragEvent, id: string, type: 'conversation' | 'folder' | 'note') => void;
  onDrop: (e: React.DragEvent, targetFolderId: string | null) => void;
  isDraggingOver: boolean;
  onDragEnter: (e: React.DragEvent, folderId: string | null) => void;
  onDragLeave: (e: React.DragEvent, folderId: string | null) => void;
  draggedItemType: 'conversation' | 'folder' | 'note' | null;
}

export function DraggableFolderItem({
  folder,
  level,
  selectedItem,
  onSelectItem,
  conversations,
  notes, // Destructure notes
  subfolders,
  onFolderUpdated,
  onFolderDeleted,
  onItemMoved,
  onCreateSubfolder,
  onDragStart,
  onDrop,
  isDraggingOver,
  onDragEnter,
  onDragLeave,
  draggedItemType,
}: DraggableFolderItemProps) {
  const { session } = useSession();
  const userId = session?.user?.id;
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState(folder.name);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredConversations = conversations.filter(conv => conv.folder_id === folder.id).sort((a, b) => a.order_index - b.order_index);
  const filteredNotes = notes.filter(note => note.folder_id === folder.id); // Filter notes
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
    const { error } = await supabase.from('folders').update({ name: editingName }).eq('id', folder.id).eq('user_id', userId);
    if (error) {
      toast.error('Error al actualizar el nombre de la carpeta.');
    } else {
      toast.success('Nombre de carpeta actualizado.');
      onFolderUpdated();
      setIsEditing(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!userId) return;
    // Move conversations and notes to root
    await supabase.from('conversations').update({ folder_id: null }).eq('folder_id', folder.id).eq('user_id', userId);
    await supabase.from('notes').update({ folder_id: null }).eq('folder_id', folder.id).eq('user_id', userId);
    if (filteredSubfolders.length > 0) {
      toast.error('No se puede eliminar una carpeta que contiene subcarpetas. Vacíalas primero.');
      setIsDeleting(false);
      return;
    }
    const { error } = await supabase.from('folders').delete().eq('id', folder.id).eq('user_id', userId);
    if (error) {
      toast.error('Error al eliminar la carpeta.');
    } else {
      toast.success('Carpeta eliminada y contenido movido a la raíz.');
      onFolderDeleted();
    }
    setIsDeleting(false);
  };

  const paddingLeft = `${level * 1.25 + 0.5}rem`;
  const MAX_FOLDER_NESTING_LEVEL = 2;

  return (
    <div className="space-y-1">
      <Card
        className={cn("cursor-pointer hover:bg-sidebar-accent transition-colors group relative", isDraggingOver && draggedItemType && "border-2 border-blue-500 bg-blue-500/10")}
        style={{ paddingLeft: paddingLeft }}
        draggable="true"
        onDragStart={(e) => onDragStart(e, folder.id, 'folder')}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => onDrop(e, folder.id)}
        onDragEnter={(e) => onDragEnter(e, folder.id)}
        onDragLeave={(e) => onDragLeave(e, folder.id)}
      >
        <CardContent className="py-1.5 px-2 flex items-center justify-between gap-1">
          <div className="flex items-center flex-1 overflow-hidden" onClick={() => setIsExpanded(!isExpanded)}>
            <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}>
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </Button>
            <Folder className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
            {isEditing ? (
              <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} onClick={(e) => e.stopPropagation()} onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()} onBlur={handleSaveEdit} className="flex-1 bg-sidebar-background text-sidebar-foreground h-7 text-sm" />
            ) : (
              <span className="text-sm font-medium truncate flex-1" onClick={(e) => { e.stopPropagation(); onSelectItem(folder.id, 'folder'); }}>{folder.name}</span>
            )}
          </div>
          <div className="flex-shrink-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {isEditing ? (
              <>
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleSaveEdit(); }} className="h-6 w-6"><Save className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setIsEditing(false); setEditingName(folder.name); }} className="h-6 w-6"><X className="h-3.5 w-3.5" /></Button>
              </>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><MoreVertical className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-popover text-popover-foreground border-border">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCreateSubfolder(folder.id); }} disabled={level >= MAX_FOLDER_NESTING_LEVEL} className={level >= MAX_FOLDER_NESTING_LEVEL ? "opacity-50 cursor-not-allowed" : ""}><Plus className="mr-2 h-4 w-4" /> Crear Subcarpeta</DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}><Edit className="mr-2 h-4 w-4" /> Renombrar</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
                    <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Eliminar</DropdownMenuItem></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer. El contenido de la carpeta se moverá a la raíz.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={(e) => { e.stopPropagation(); handleDeleteFolder(); }}>Eliminar</AlertDialogAction></AlertDialogFooter>
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
            <DraggableFolderItem key={subfolder.id} folder={subfolder} level={level + 1} selectedItem={selectedItem} onSelectItem={onSelectItem} conversations={conversations} notes={notes} subfolders={subfolders} onFolderUpdated={onFolderUpdated} onFolderDeleted={onFolderDeleted} onItemMoved={onItemMoved} onCreateSubfolder={onCreateSubfolder} onDragStart={onDragStart} onDrop={onDrop} isDraggingOver={false} onDragEnter={onDragEnter} onDragLeave={onDragLeave} draggedItemType={draggedItemType} />
          ))}
          {filteredConversations.map((conversation) => (
            <DraggableConversationCard key={conversation.id} conversation={conversation} selectedConversationId={selectedItem?.type === 'conversation' ? selectedItem.id : null} onSelectConversation={(id) => onSelectItem(id!, 'conversation')} onConversationUpdated={onFolderUpdated} onConversationDeleted={onFolderUpdated} onConversationMoved={() => {}} onConversationReordered={() => {}} allFolders={[]} level={level + 1} onDragStart={(e) => onDragStart(e, conversation.id, 'conversation')} isDraggingOver={false} dropPosition={null} />
          ))}
          {filteredNotes.map((note) => (
            <DraggableNoteItem key={note.id} note={note} selected={selectedItem?.type === 'note' && selectedItem.id === note.id} onSelect={() => onSelectItem(note.id, 'note')} onDragStart={(e) => onDragStart(e, note.id, 'note')} level={level + 1} onNoteUpdated={onFolderUpdated} onNoteDeleted={onFolderDeleted} />
          ))}
        </div>
      )}
    </div>
  );
}