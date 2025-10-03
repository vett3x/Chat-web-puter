"use client";

import React, { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/session-context-provider';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, Loader2, Wand2, X, Check } from 'lucide-react';
import { NoteAiChat } from './note-ai-chat';
import { ChatMessage } from '@/hooks/use-note-assistant-chat';
import { ApiKey, AiKeyGroup } from '@/hooks/use-user-api-keys';
import MDEditor from '@uiw/react-md-editor';
import { useTheme } from 'next-themes';

interface Note {
  id: string;
  title: string;
  content: string | null; // Content is now a string
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
}

export interface NoteEditorPanelRef {
  refreshNoteContent: () => void;
}

export const NoteEditorPanel = forwardRef<NoteEditorPanelRef, NoteEditorPanelProps>(({ noteId, onNoteUpdated, userApiKeys, aiKeyGroups, isLoadingApiKeys, userLanguage }, ref) => {
  const { session } = useSession();
  const { resolvedTheme } = useTheme();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [showAiHint, setShowAiHint] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('saved');

  const handleSave = useCallback(async (currentTitle: string, currentContent: string) => {
    if (!note || saveStatus === 'saving') return;

    setSaveStatus('saving');
    const { error } = await supabase.from('notes').update({ title: currentTitle, content: currentContent }).eq('id', note.id);

    if (error) {
      toast.error('Error en el autoguardado.');
      setSaveStatus('idle');
    } else {
      const updatedData = { title: currentTitle, content: currentContent, updated_at: new Date().toISOString() };
      onNoteUpdated(note.id, updatedData);
      setNote(prev => prev ? { ...prev, ...updatedData } : null);
      setSaveStatus('saved');
    }
  }, [note, onNoteUpdated, saveStatus]);

  // Debounce saving for content
  useEffect(() => {
    if (isLoading || !note || content === note.content) return;
    setSaveStatus('idle');
    const handler = setTimeout(() => {
      handleSave(title, content);
    }, 2000);
    return () => clearTimeout(handler);
  }, [content, note, isLoading, title, handleSave]);

  // Debounce saving for title
  useEffect(() => {
    if (isLoading || !note || title === note.title) return;
    setSaveStatus('idle');
    const handler = setTimeout(() => {
      handleSave(title, content);
    }, 2000);
    return () => clearTimeout(handler);
  }, [title, note, isLoading, content, handleSave]);

  const fetchNote = useCallback(async () => {
    if (!session?.user?.id || !noteId) return;
    setIsLoading(true);
    const { data, error } = await supabase.from('notes').select('id, title, content, updated_at, chat_history').eq('id', noteId).eq('user_id', session.user.id).single();
    if (error) {
      toast.error('No se pudo cargar la nota.');
      console.error(error);
    } else {
      setNote(data);
      setTitle(data.title);
      setContent(data.content || '');
    }
    setIsLoading(false);
  }, [noteId, session?.user?.id]);

  useEffect(() => { 
    if (noteId && session?.user?.id) {
      fetchNote(); 
    }
  }, [noteId, session?.user?.id, fetchNote]);

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
          preview="live"
          className="[&>div]:!border-none"
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
      />
    </div>
  );
});

NoteEditorPanel.displayName = 'NoteEditorPanel';