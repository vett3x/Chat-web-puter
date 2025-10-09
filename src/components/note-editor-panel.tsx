"use client";

import React, { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/session-context-provider';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, Loader2, Wand2, X, Check, Bold, Italic, Strikethrough, Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code, Link, Image as ImageIcon, Table, ListTodo } from 'lucide-react';
import { NoteAiChat } from './note-ai-chat';
import { ChatMessage } from '@/hooks/use-note-assistant-chat';
import { ApiKey, AiKeyGroup } from '@/hooks/use-user-api-keys';
import MDEditor, { commands, TextAreaTextApi, TextState } from '@uiw/react-md-editor';
import { useTheme } from 'next-themes';

interface Note {
  id: string;
  title: string;
  content: string | null;
  updated_at: string;
  chat_history: ChatMessage[] | null;
}

interface NoteEditorPanelProps {
  noteId: string;
  onNoteUpdated: (id: string, updatedData: Partial<Note>) => void;
  userApiKeys: ApiKey[];
  aiKeyGroups: AiKeyGroup[];
  isLoadingApiKeys: boolean;
  userLanguage: string;
  userDefaultModel: string | null;
}

export interface NoteEditorPanelRef {
  refreshNoteContent: () => void;
}

export const NoteEditorPanel = forwardRef<NoteEditorPanelRef, NoteEditorPanelProps>(({ noteId, onNoteUpdated, userApiKeys, aiKeyGroups, isLoadingApiKeys, userLanguage, userDefaultModel }, ref) => {
  const { session, globalRefreshKey } = useSession();
  const { resolvedTheme } = useTheme();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [showAiHint, setShowAiHint] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('saved');
  // `preview` se establece en "live" para mostrar el editor y la vista previa simultáneamente.
  // El MDEditor gestiona el layout automáticamente en este modo.
  const [previewMode, setPreviewMode] = useState<'live'>('live'); 

  const imageInputRef = useRef<HTMLInputElement>(null);
  const editorApiRef = useRef<TextAreaTextApi | null>(null);

  const handleImageUpload = async function* (data: DataTransfer, setMarkdown: (markdown: string) => void) {
    if (!session?.user?.id || !note?.id) {
      toast.error("Debes iniciar sesión para subir imágenes.");
      return;
    }

    const files = Array.from(data.items).map(item => item.getAsFile()).filter(Boolean) as File[];
    if (files.length === 0) return;

    const toastId = toast.loading(`Subiendo ${files.length} imagen(es)...`);

    for (const file of files) {
      const filePath = `${session.user.id}/${note.id}/${Date.now()}-${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('notes-images')
        .upload(filePath, file);

      if (uploadError) {
        console.error("Error uploading image:", uploadError);
        toast.error(`Error al subir ${file.name}: ${uploadError.message}`, { id: toastId });
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('notes-images')
        .getPublicUrl(filePath);

      if (publicUrl) {
        const markdownImage = `![${file.name}](${publicUrl})`;
        setMarkdown(markdownImage);
      }
    }
    toast.success("Imágenes subidas correctamente.", { id: toastId });
  };

  const handleFileSelectAndUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!session?.user?.id || !note?.id || !editorApiRef.current) {
      toast.error("No se puede subir la imagen en este momento.");
      return;
    }

    const files = event.target.files;
    if (!files || files.length === 0) return;

    const toastId = toast.loading(`Subiendo ${files.length} imagen(es)...`);

    for (const file of files) {
      const filePath = `${session.user.id}/${note.id}/${Date.now()}-${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('notes-images')
        .upload(filePath, file);

      if (uploadError) {
        console.error("Error uploading image:", uploadError);
        toast.error(`Error al subir ${file.name}: ${uploadError.message}`, { id: toastId });
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('notes-images')
        .getPublicUrl(filePath);

      if (publicUrl) {
        const markdownImage = `![${file.name}](${publicUrl})`;
        editorApiRef.current.replaceSelection(markdownImage);
      }
    }
    toast.success("Imágenes subidas correctamente.", { id: toastId });

    if (event.target) {
      event.target.value = '';
    }
  };

  const customImageCommand: commands.ICommand = {
    name: 'image',
    keyCommand: 'image',
    icon: <ImageIcon size={16} />,
    buttonProps: { 'aria-label': 'Insert image' },
    execute: (state: TextState, api: TextAreaTextApi) => {
      editorApiRef.current = api;
      imageInputRef.current?.click();
    },
  };

  const customCommands = [
    { ...commands.bold, icon: <Bold size={16} /> },
    { ...commands.italic, icon: <Italic size={16} /> },
    { ...commands.strikethrough, icon: <Strikethrough size={16} /> },
    commands.divider,
    commands.group(
      [
        { ...commands.title1, icon: <Heading1 size={16} /> },
        { ...commands.title2, icon: <Heading2 size={16} /> },
        { ...commands.title3, icon: <Heading3 size={16} /> },
      ],
      {
        name: 'title',
        groupName: 'title',
        buttonProps: { 'aria-label': 'Insert title' },
      }
    ),
    commands.divider,
    { ...commands.link, icon: <Link size={16} /> },
    { ...commands.quote, icon: <Quote size={16} /> },
    { ...commands.code, icon: <Code size={16} /> },
    { ...commands.codeBlock, icon: <Code size={16} /> },
    customImageCommand,
    { ...commands.table, icon: <Table size={16} /> },
    commands.divider,
    { ...commands.unorderedListCommand, icon: <List size={16} /> },
    { ...commands.orderedListCommand, icon: <ListOrdered size={16} /> },
    { ...commands.checkedListCommand, icon: <ListTodo size={16} /> },
    // El botón de toggle-preview se ha eliminado porque el modo "live" lo hace innecesario.
  ];

  const handleSave = useCallback(async (currentTitle: string, currentContent: string) => {
    if (!note || saveStatus === 'saving') return;

    setSaveStatus('saving');
    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: currentTitle, content: currentContent }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error en el autoguardado.');
      }
      const updatedData = { title: currentTitle, content: currentContent, updated_at: new Date().toISOString() };
      onNoteUpdated(note.id, updatedData);
      setNote(prev => prev ? { ...prev, ...updatedData } : null);
      setSaveStatus('saved');
    } catch (error: any) {
      toast.error(error.message);
      setSaveStatus('idle');
    }
  }, [note, onNoteUpdated, saveStatus]);

  useEffect(() => {
    if (isLoading || !note || content === note.content) return;
    setSaveStatus('idle');
    const handler = setTimeout(() => {
      handleSave(title, content);
    }, 2000);
    return () => clearTimeout(handler);
  }, [content, note, isLoading, title, handleSave]);

  useEffect(() => {
    if (isLoading || !note || title === note.title) return;
    setSaveStatus('idle');
    const handler = setTimeout(() => {
      handleSave(title, content);
    }, 2000);
    return () => clearTimeout(handler);
  }, [title, note, isLoading, content, handleSave]);

  const fetchNote = useCallback(async () => {
    if (!noteId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/notes/${noteId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'No se pudo cargar la nota.');
      }
      const data = await response.json();
      setNote(data);
      setTitle(data.title);
      setContent(data.content || '');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [noteId]);

  useEffect(() => { 
    if (noteId && session?.user?.id) {
      fetchNote(); 
    }
  }, [noteId, session?.user?.id, fetchNote, globalRefreshKey]);

  useEffect(() => {
    const hasSeenHint = localStorage.getItem('hasSeenNoteAiHint');
    if (!hasSeenHint) {
      setShowAiHint(true);
      const timer = setTimeout(() => { setShowAiHint(false); }, 10000);
      localStorage.setItem('hasSeenNoteAiHint', 'true');
      return () => clearTimeout(timer);
    }
  }, [noteId]);

  const handleSaveChatHistory = useCallback(async (newHistory: ChatMessage[]) => {
    if (!note) return;
    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_history: newHistory }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al guardar el historial del chat.');
      }
      setNote(prev => prev ? { ...prev, chat_history: newHistory } : null);
    } catch (error: any) {
      toast.error(error.message);
    }
  }, [note]);

  useImperativeHandle(ref, () => ({
    refreshNoteContent: fetchNote,
  }));

  if (isLoading || isLoadingApiKeys) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /><p className="ml-2 text-muted-foreground">Cargando nota y claves...</p></div>;
  }
  if (!note) {
    return <div className="flex items-center justify-center h-full"><p>Nota no encontrada.</p></div>;
  }

  return (
    <div className="h-full w-full flex flex-col bg-background relative" data-color-mode={resolvedTheme}>
      <input
        type="file"
        ref={imageInputRef}
        onChange={handleFileSelectAndUpload}
        accept="image/*"
        multiple
        hidden
      />
      <div className="flex items-center justify-between p-2 border-b bg-muted">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-lg font-semibold border-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent" disabled={saveStatus === 'saving'} />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground w-24 justify-end">
            {saveStatus === 'saving' && <><Loader2 className="h-3 w-3 animate-spin" /><span>Guardando...</span></>}
            {saveStatus === 'saved' && <><Check className="h-3 w-3 text-green-500" /><span>Guardado</span></>}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <MDEditor
          value={content}
          onChange={(val) => setContent(val || '')}
          height="100%"
          commands={customCommands}
          preview={previewMode} // Usamos el modo 'live'
          className="[&>div]:!border-none [&>div]:!bg-background"
        />
      </div>
      {showAiHint && (<div className="absolute bottom-20 right-4 bg-info text-info-foreground p-2 rounded-md shadow-lg text-sm animate-in fade-in slide-in-from-bottom-2 flex items-center gap-2 z-10"><span>¡Usa la IA para chatear con tu nota!</span><Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setShowAiHint(false)}><X className="h-3 w-3" /></Button></div>)}
      <Button variant="destructive" size="icon" onClick={() => setIsAiChatOpen(prev => !prev)} className="absolute bottom-4 right-4 rounded-full h-12 w-12 animate-pulse-red z-10" title="Asistente de Nota"><Wand2 className="h-6 w-6" /></Button>
      <NoteAiChat
        isOpen={isAiChatOpen}
        onClose={() => setIsAiChatOpen(false)}
        noteTitle={title}
        noteContent={content}
        initialChatHistory={note.chat_history}
        onSaveHistory={handleSaveChatHistory}
        userApiKeys={userApiKeys}
        aiKeyGroups={aiKeyGroups}
        isLoadingApiKeys={isLoadingApiKeys}
        userDefaultModel={userDefaultModel}
      />
    </div>
  );
});

NoteEditorPanel.displayName = 'NoteEditorPanel';