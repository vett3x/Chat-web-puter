"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/session-context-provider';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, Loader2 } from 'lucide-react';
import { BlockNoteViewRaw as BlockNoteView } from "@blocknote/react";
import { BlockNoteEditor } from "@blocknote/core";
import "@blocknote/core/style.css";
import { useTheme } from 'next-themes';

interface Note {
  id: string;
  title: string;
  content: string | null;
  updated_at: string;
}

interface NoteEditorPanelProps {
  noteId: string;
  onNoteUpdated: () => void;
}

export function NoteEditorPanel({ noteId, onNoteUpdated }: NoteEditorPanelProps) {
  const { session } = useSession();
  const { theme } = useTheme();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isContentLoaded, setIsContentLoaded] = useState(false);

  // Creates a new editor instance.
  const editor: BlockNoteEditor | null = useMemo(() => {
    if (isContentLoaded) {
      return BlockNoteEditor.create({
        initialContent: note?.content ? JSON.parse(note.content) : undefined,
      });
    }
    return null;
  }, [isContentLoaded, note?.content]);

  const fetchNote = useCallback(async () => {
    if (!session?.user?.id || !noteId) return;
    setIsLoading(true);
    setIsContentLoaded(false);
    const { data, error } = await supabase
      .from('notes')
      .select('id, title, content, updated_at')
      .eq('id', noteId)
      .eq('user_id', session.user.id)
      .single();

    if (error) {
      toast.error('No se pudo cargar la nota.');
      console.error(error);
    } else {
      setNote(data);
      setTitle(data.title);
      setIsContentLoaded(true);
    }
    setIsLoading(false);
  }, [noteId, session?.user?.id]);

  useEffect(() => {
    fetchNote();
  }, [fetchNote]);

  const handleSave = async () => {
    if (!note || !editor) return;
    setIsSaving(true);
    
    const contentJSON = JSON.stringify(editor.topLevelBlocks);

    const { error } = await supabase
      .from('notes')
      .update({ title, content: contentJSON })
      .eq('id', note.id);

    if (error) {
      toast.error('Error al guardar la nota.');
    } else {
      toast.success('Nota guardada.');
      onNoteUpdated();
      fetchNote();
    }
    setIsSaving(false);
  };

  if (isLoading || !editor) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="h-full w-full flex flex-col bg-background">
      <div className="flex items-center justify-between p-2 border-b bg-muted">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-lg font-semibold border-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
          disabled={isSaving}
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <BlockNoteView 
          editor={editor} 
          theme={theme === 'dark' ? 'dark' : 'light'}
          className="h-full"
        />
      </div>
    </div>
  );
}