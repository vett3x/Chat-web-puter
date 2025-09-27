"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/session-context-provider';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, Loader2, Wand2, X, Check } from 'lucide-react';
import { NoteAiChat } from './note-ai-chat'; // Corrected import path for NoteAiChat component
import { ChatMessage } from '@/hooks/use-note-assistant-chat'; // ChatMessage is still from the hook
import { ApiKey } from '@/hooks/use-user-api-keys';

// BlockNote imports
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView, darkDefaultTheme, type Theme } from "@blocknote/mantine";
import { type Block, type BlockNoteEditor } from "@blocknote/core";
import * as locales from "@blocknote/core/locales"; // Import all locales
import "@blocknote/mantine/style.css";
import { useTheme } from 'next-themes';

// Create a custom dark theme that uses the app's CSS variables
const customDarkTheme: Theme = {
  ...darkDefaultTheme,
  colors: {
    ...darkDefaultTheme.colors,
    editor: {
      background: "hsl(var(--background))",
      text: "hsl(var(--foreground))",
    },
    sideMenu: "hsl(var(--foreground))",
    tooltip: {
        background: "hsl(var(--muted))",
        text: "hsl(var(--muted-foreground))",
    },
    menu: {
        background: "hsl(var(--card))",
        text: "hsl(var(--card-foreground))",
    },
  },
};

interface Note {
  id: string;
  title: string;
  content: any;
  updated_at: string;
  chat_history: ChatMessage[] | null;
}

interface NoteEditorPanelProps {
  noteId: string;
  onNoteUpdated: (id: string, updatedData: Partial<Note>) => void;
  userApiKeys: ApiKey[];
  isLoadingApiKeys: boolean;
  userLanguage: string; // New prop for user language
}

export function NoteEditorPanel({ noteId, onNoteUpdated, userApiKeys, isLoadingApiKeys, userLanguage }: NoteEditorPanelProps) {
  const { session } = useSession();
  const { theme } = useTheme();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [initialContent, setInitialContent] = useState<any>(null); // This is the content from DB, used for comparison
  const [isLoading, setIsLoading] = useState(true);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [showAiHint, setShowAiHint] = useState(false);
  const [noteContentForChat, setNoteContentForChat] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('saved');
  const [isMounted, setIsMounted] = useState(false);
  const [editorReady, setEditorReady] = useState(false);

  // Refs para acceder a los valores más recientes de los estados dentro de useCallback
  const latestTitleRef = useRef(title);
  const latestNoteRef = useRef(note);
  const latestSaveStatusRef = useRef(saveStatus);

  useEffect(() => { latestTitleRef.current = title; }, [title]);
  useEffect(() => { latestNoteRef.current = note; }, [note]);
  useEffect(() => { latestSaveStatusRef.current = saveStatus; }, [saveStatus]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const editor = useCreateBlockNote({
    dictionary: locales[userLanguage as keyof typeof locales] || locales.es,
    onEditorReady: () => {
      setEditorReady(true);
    }
  });

  const handleSave = useCallback(async () => {
    const currentNote = latestNoteRef.current;
    const currentTitle = latestTitleRef.current;
    const currentSaveStatus = latestSaveStatusRef.current;

    if (!currentNote || currentSaveStatus === 'saving' || !editor || !editorReady) return;

    setSaveStatus('saving');
    const currentContent = editor.topLevelBlocks;
    const { error } = await supabase.from('notes').update({ title: currentTitle, content: currentContent }).eq('id', currentNote.id);

    if (error) {
      toast.error('Error en el autoguardado.');
      setSaveStatus('idle');
    } else {
      const updatedData = { title: currentTitle, content: currentContent, updated_at: new Date().toISOString() };
      onNoteUpdated(currentNote.id, updatedData);
      setNote(prev => prev ? { ...prev, ...updatedData } : null);
      setInitialContent(currentContent); // Update initialContent to reflect saved state
      setSaveStatus('saved');
    }
  }, [noteId, onNoteUpdated, setNote, setSaveStatus, editor, editorReady]); // Dependencias estables

  // Efecto para autoguardado de contenido del editor
  useEffect(() => {
    if (!editor || !editorReady || !note) return;
    let debounceTimeout: NodeJS.Timeout;
    const handleContentChange = () => {
      if (latestSaveStatusRef.current !== 'saving') {
        setSaveStatus('idle');
      }
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(async () => {
        const currentContent = editor.topLevelBlocks;
        // Compara con el initialContent (último contenido guardado)
        if (JSON.stringify(currentContent) !== JSON.stringify(initialContent)) {
           handleSave();
        } else {
           setSaveStatus('saved'); // Si no hay cambios, vuelve a 'saved'
        }
      }, 2000);
    };
    editor.onEditorContentChange(handleContentChange);
    return () => {
      clearTimeout(debounceTimeout);
    };
  }, [editor, editorReady, handleSave, note, initialContent]); // Depende de initialContent para la comparación

  // Efecto para autoguardado de título
  useEffect(() => {
    if (isLoading || !editorReady || !note) return;
    // Solo guardar si el título del input es diferente al título de la nota guardada
    if (title === note.title) return;

    if (latestSaveStatusRef.current !== 'saving') {
      setSaveStatus('idle');
    }

    const handler = setTimeout(() => {
      handleSave();
    }, 1000); // Debounce más corto para el título
    return () => { clearTimeout(handler); };
  }, [title, note?.title, isLoading, editorReady, handleSave, note]); // Depende de note.title para la comparación

  const fetchNote = useCallback(async () => {
    if (!session?.user?.id || !noteId || !editor || !editorReady) return;
    setIsLoading(true);
    const { data, error } = await supabase.from('notes').select('id, title, content, updated_at, chat_history').eq('id', noteId).eq('user_id', session.user.id).single();
    if (error) {
      toast.error('No se pudo cargar la nota.');
      console.error(error);
    } else {
      setNote(data);
      setTitle(data.title);
      if (typeof data.content === 'string') {
        const blocks = await editor.tryParseMarkdownToBlocks(data.content);
        setInitialContent(blocks); // Establecer initialContent aquí
      } else {
        setInitialContent(data.content); // Establecer initialContent aquí
      }
    }
    setIsLoading(false);
  }, [noteId, session?.user?.id, editor, editorReady]);

  useEffect(() => {
    if (editorReady) {
      fetchNote();
    }
  }, [fetchNote, editorReady]);

  useEffect(() => {
    if (initialContent && editor && editorReady) {
      const loadContent = async () => {
        editor.replaceBlocks(editor.topLevelBlocks, initialContent);
        const markdown = await editor.blocksToMarkdownLossy();
        setNoteContentForChat(markdown);
      };
      loadContent();
    }
  }, [initialContent, editor, editorReady]);

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
    const { error } = await supabase.from('notes').update({ chat_history: newHistory }).eq('id', note.id);
    if (error) {
      toast.error('Error al guardar el historial del chat.');
    } else {
      setNote(prev => prev ? { ...prev, chat_history: newHistory } : null);
    }
  }, [note]);

  if (isLoading || isLoadingApiKeys) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /><p className="ml-2 text-muted-foreground">Cargando nota y claves...</p></div>;
  }
  if (!note) {
    return <div className="flex items-center justify-center h-full"><p>Nota no encontrada.</p></div>;
  }

  return (
    <div className="h-full w-full flex flex-col bg-background relative">
      <div className="flex items-center justify-between p-2 border-b bg-muted">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-lg font-semibold border-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent" disabled={saveStatus === 'saving'} />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground w-24 justify-end">
            {saveStatus === 'saving' && <><Loader2 className="h-3 w-3 animate-spin" /><span>Guardando...</span></>}
            {saveStatus === 'saved' && <><Check className="h-3 w-3 text-green-500" /><span>Guardado</span></>}
            {saveStatus === 'idle' && <span className="text-yellow-500">Sin guardar</span>}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isMounted && editor && editorReady ? (
          <BlockNoteView editor={editor} theme={theme === 'dark' ? customDarkTheme : 'light'} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-2 text-muted-foreground">Cargando editor...</p>
          </div>
        )}
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