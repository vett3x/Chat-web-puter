"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/session-context-provider';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, Loader2, Wand2, X } from 'lucide-react';
import { NoteAiChat, ChatMessage } from './note-ai-chat';
import { ApiKey } from '@/hooks/use-user-api-keys';

// BlockNote imports
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { type Block, type BlockNoteEditor } from "@blocknote/core";
import "@blocknote/mantine/style.css";
import { useTheme } from 'next-themes';

interface Note {
  id: string;
  title: string;
  content: any; // Now can be string (old) or JSONB (new)
  updated_at: string;
  chat_history: ChatMessage[] | null;
}

interface NoteEditorPanelProps {
  noteId: string;
  onNoteUpdated: () => void;
  userApiKeys: ApiKey[];
  isLoadingApiKeys: boolean;
}

export function NoteEditorPanel({ noteId, onNoteUpdated, userApiKeys, isLoadingApiKeys }: NoteEditorPanelProps) {
  const { session } = useSession();
  const { theme } = useTheme();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [initialContent, setInitialContent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [showAiHint, setShowAiHint] = useState(false);
  const [noteContentForChat, setNoteContentForChat] = useState('');

  const editor = useCreateBlockNote();

  // Effect to update the markdown representation for the AI chat
  // whenever the editor content changes.
  useEffect(() => {
    if (!editor) {
      return;
    }
    const updateMarkdownContent = async () => {
      const markdown = await editor.blocksToMarkdown(editor.topLevelBlocks);
      setNoteContentForChat(markdown);
    };
    
    const debouncedUpdate = setTimeout(updateMarkdownContent, 500); // Debounce to avoid running on every keystroke
    return () => clearTimeout(debouncedUpdate);

  }, [editor, editor?.topLevelBlocks]);

  const fetchNote = useCallback(async () => {
    if (!session?.user?.id || !noteId || !editor) return;
    setIsLoading(true);
    const { data, error } = await supabase.from('notes').select('id, title, content, updated_at, chat_history').eq('id', noteId).eq('user_id', session.user.id).single();
    if (error) {
      toast.error('No se pudo cargar la nota.');
      console.error(error);
    } else {
      setNote(data);
      setTitle(data.title);
      // Handle content migration from Markdown string to BlockNote JSON
      if (typeof data.content === 'string') {
        // If it's an old note (Markdown string), convert it to blocks
        const blocks = await editor.markdownToBlocks(data.content);
        setInitialContent(blocks);
      } else {
        // If it's a new note (already JSONB), use it directly
        setInitialContent(data.content);
      }
    }
    setIsLoading(false);
  }, [noteId, session?.user?.id, editor]);

  useEffect(() => { fetchNote(); }, [fetchNote]);

  // Load initial content into the editor once it's fetched
  useEffect(() => {
    if (initialContent && editor) {
      editor.replaceBlocks(editor.topLevelBlocks, initialContent);
    }
  }, [initialContent, editor]);

  useEffect(() => {
    const hasSeenHint = localStorage.getItem('hasSeenNoteAiHint');
    if (!hasSeenHint) {
      setShowAiHint(true);
      const timer = setTimeout(() => { setShowAiHint(false); }, 10000);
      localStorage.setItem('hasSeenNoteAiHint', 'true');
      return () => clearTimeout(timer);
    }
  }, [noteId]);

  const handleSave = useCallback(async () => {
    if (!note || isSaving || !editor) return;
    setIsSaving(true);
    const currentContent = editor.topLevelBlocks;
    const { error } = await supabase.from('notes').update({ title, content: currentContent }).eq('id', note.id);
    if (error) {
      toast.error('Error al guardar la nota.');
    } else {
      toast.success('Nota guardada.');
      onNoteUpdated();
      setNote(prev => prev ? { ...prev, title, content: currentContent, updated_at: new Date().toISOString() } : null);
    }
    setIsSaving(false);
  }, [note, title, isSaving, onNoteUpdated, editor]);

  const handleSaveChatHistory = useCallback(async (newHistory: ChatMessage[]) => {
    if (!note) return;
    const { error } = await supabase.from('notes').update({ chat_history: newHistory }).eq('id', note.id);
    if (error) {
      toast.error('Error al guardar el historial del chat.');
    } else {
      setNote(prev => prev ? { ...prev, chat_history: newHistory } : null);
    }
  }, [note]);

  // Auto-save on title change
  useEffect(() => {
    if (isSaving || isLoading || !note) return;
    if (title === note.title) return;
    const handler = setTimeout(() => { handleSave(); }, 2000);
    return () => { clearTimeout(handler); };
  }, [title, note, isSaving, isLoading, handleSave]);

  if (isLoading || isLoadingApiKeys) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /><p className="ml-2 text-muted-foreground">Cargando nota y claves...</p></div>;
  }
  if (!note) {
    return <div className="flex items-center justify-center h-full"><p>Nota no encontrada.</p></div>;
  }

  return (
    <div className="h-full w-full flex flex-col bg-background relative">
      <div className="flex items-center justify-between p-2 border-b bg-muted">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-lg font-semibold border-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent" disabled={isSaving} />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Guardar</Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <BlockNoteView editor={editor} theme={theme === 'dark' ? 'dark' : 'light'} />
      </div>
      {showAiHint && (<div className="absolute bottom-20 right-4 bg-info text-info-foreground p-2 rounded-md shadow-lg text-sm animate-in fade-in slide-in-from-bottom-2 flex items-center gap-2 z-10"><span>¡Usa la IA para chatear con tu nota!</span><Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setShowAiHint(false)}><X className="h-3 w-3" /></Button></div>)}
      <Button variant="destructive" size="icon" onClick={() => setIsAiChatOpen(prev => !prev)} className="absolute bottom-4 right-4 rounded-full h-12 w-12 animate-pulse-red z-10" title="Asistente de Nota"><Wand2 className="h-6 w-6" /></Button>
      <NoteAiChat
        isOpen={isAiChatOpen}
        onClose={() => setIsAiChatOpen(false)}
        noteTitle={title}
        noteContent={noteContentForChat}
        initialChatHistory={note.chat_history}
        onSaveHistory={handleSaveChatHistory}
        userApiKeys={userApiKeys}
        isLoadingApiKeys={isLoadingApiKeys}
      />
    </div>
  );
}