"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/session-context-provider';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Search, 
  FileText, 
  Folder, 
  FolderOpen, 
  MoreHorizontal, 
  Trash2, 
  Edit2,
  ChevronRight,
  ChevronDown,
  Settings
} from 'lucide-react';
import { NoteEditorPanel } from '@/components/note-editor-panel';
import { useUserApiKeys } from '@/hooks/use-user-api-keys';
import { UserSettingsDialog } from '@/components/user-settings-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Note {
  id: string;
  title: string;
  content: any;
  created_at: string;
  updated_at: string;
  folder_id: string | null;
}

interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

export default function Home() {
  const { session } = useSession();
  const { userApiKeys, isLoading: isLoadingApiKeys } = useUserApiKeys();
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const fetchNotesAndFolders = useCallback(async () => {
    if (!session?.user?.id) return;
    
    setIsLoading(true);
    try {
      const [notesResponse, foldersResponse] = await Promise.all([
        supabase.from('notes').select('*').eq('user_id', session.user.id).order('updated_at', { ascending: false }),
        supabase.from('folders').select('*').eq('user_id', session.user.id).order('name')
      ]);

      if (notesResponse.error) throw notesResponse.error;
      if (foldersResponse.error) throw foldersResponse.error;

      setNotes(notesResponse.data || []);
      setFolders(foldersResponse.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar las notas y carpetas.');
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchNotesAndFolders();
  }, [fetchNotesAndFolders]);

  const createNote = async (folderId?: string) => {
    if (!session?.user?.id) return;

    try {
      const { data, error } = await supabase.from('notes').insert({
        title: 'Nueva nota',
        content: [{ type: 'paragraph', content: '' }],
        user_id: session.user.id,
        folder_id: folderId || null
      }).select().single();

      if (error) throw error;

      setNotes(prev => [data, ...prev]);
      setSelectedNoteId(data.id);
      toast.success('Nueva nota creada.');
    } catch (error) {
      console.error('Error creating note:', error);
      toast.error('Error al crear la nota.');
    }
  };

  const createFolder = async () => {
    if (!session?.user?.id || !newFolderName.trim()) return;

    try {
      const { data, error } = await supabase.from('folders').insert({
        name: newFolderName.trim(),
        user_id: session.user.id
      }).select().single();

      if (error) throw error;

      setFolders(prev => [...prev, data]);
      setNewFolderName('');
      setIsCreatingFolder(false);
      toast.success('Carpeta creada.');
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Error al crear la carpeta.');
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase.from('notes').delete().eq('id', noteId);
      if (error) throw error;

      setNotes(prev => prev.filter(note => note.id !== noteId));
      if (selectedNoteId === noteId) {
        setSelectedNoteId(null);
      }
      toast.success('Nota eliminada.');
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Error al eliminar la nota.');
    }
  };

  const deleteFolder = async (folderId: string) => {
    try {
      const { error } = await supabase.from('folders').delete().eq('id', folderId);
      if (error) throw error;

      setFolders(prev => prev.filter(folder => folder.id !== folderId));
      toast.success('Carpeta eliminada.');
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast.error('Error al eliminar la carpeta.');
    }
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const handleNoteUpdated = (noteId: string, updatedData: Partial<Note>) => {
    setNotes(prev => prev.map(note => 
      note.id === noteId ? { ...note, ...updatedData } : note
    ));
  };

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const notesWithoutFolder = filteredNotes.filter(note => !note.folder_id);
  const notesInFolders = filteredNotes.filter(note => note.folder_id);

  const renderFolderTree = (parentId: string | null = null) => {
    return folders
      .filter(folder => folder.parent_id === parentId)
      .map(folder => {
        const folderNotes = notesInFolders.filter(note => note.folder_id === folder.id);
        const isExpanded = expandedFolders.has(folder.id);

        return (
          <div key={folder.id} className="space-y-1">
            <div className="flex items-center gap-1 p-2 hover:bg-muted rounded-md group">
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0"
                onClick={() => toggleFolder(folder.id)}
              >
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </Button>
              {isExpanded ? <FolderOpen className="h-4 w-4 text-blue-500" /> : <Folder className="h-4 w-4 text-blue-500" />}
              <span className="flex-1 text-sm font-medium">{folder.name}</span>
              <Badge variant="secondary" className="text-xs">
                {folderNotes.length}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => createNote(folder.id)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva nota
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => deleteFolder(folder.id)} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar carpeta
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {isExpanded && (
              <div className="ml-6 space-y-1">
                {folderNotes.map(note => (
                  <div
                    key={note.id}
                    className={`flex items-center gap-2 p-2 rounded-md cursor-pointer group ${
                      selectedNoteId === note.id ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedNoteId(note.id)}
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{note.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(note.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => deleteNote(note.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      });
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Por favor, inicia sesión para acceder a tus notas.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r bg-muted/30 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold">Mis Notas</h1>
            <div className="flex items-center gap-2">
              <UserSettingsDialog>
                <Button variant="ghost" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </UserSettingsDialog>
              <Button onClick={() => createNote()} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nueva nota
              </Button>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar notas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Create Folder */}
            <div className="space-y-2">
              {isCreatingFolder ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="Nombre de la carpeta"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && createFolder()}
                    autoFocus
                  />
                  <Button onClick={createFolder} size="sm">
                    Crear
                  </Button>
                  <Button onClick={() => setIsCreatingFolder(false)} variant="outline" size="sm">
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setIsCreatingFolder(true)}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva carpeta
                </Button>
              )}
            </div>

            <Separator />

            {/* Folders */}
            {folders.length > 0 && (
              <div className="space-y-1">
                {renderFolderTree()}
              </div>
            )}

            {/* Notes without folder */}
            {notesWithoutFolder.length > 0 && (
              <>
                {folders.length > 0 && <Separator />}
                <div className="space-y-1">
                  {notesWithoutFolder.map(note => (
                    <div
                      key={note.id}
                      className={`flex items-center gap-2 p-2 rounded-md cursor-pointer group ${
                        selectedNoteId === note.id ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-muted'
                      }`}
                      onClick={() => setSelectedNoteId(note.id)}
                    >
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{note.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(note.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => deleteNote(note.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Empty state */}
            {notes.length === 0 && !isLoading && (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No tienes notas aún</p>
                <Button onClick={() => createNote()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear tu primera nota
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {selectedNoteId ? (
          <NoteEditorPanel
            noteId={selectedNoteId}
            onNoteUpdated={handleNoteUpdated}
            userApiKeys={userApiKeys}
            isLoadingApiKeys={isLoadingApiKeys}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Selecciona una nota para empezar a escribir</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}