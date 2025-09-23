"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/session-context-provider';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, Loader2, Eye, Code } from 'lucide-react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Note {
  id: string;
  title: string;
  content: string | null;
  updated_at: string;
}

interface NoteEditorPanelProps {
  noteId: string;
  onNoteUpdated: () => void; // Callback to refresh sidebar
}

export function NoteEditorPanel({ noteId, onNoteUpdated }: NoteEditorPanelProps) {
  const { session } = useSession();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'editor' | 'preview'>('split');

  const fetchNote = useCallback(async () => {
    if (!session?.user?.id || !noteId) return;
    setIsLoading(true);
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
      setContent(data.content || '');
    }
    setIsLoading(false);
  }, [noteId, session?.user?.id]);

  useEffect(() => {
    fetchNote();
  }, [fetchNote]);

  const handleSave = async () => {
    if (!note) return;
    setIsSaving(true);
    const { error } = await supabase
      .from('notes')
      .update({ title, content })
      .eq('id', note.id);

    if (error) {
      toast.error('Error al guardar la nota.');
    } else {
      toast.success('Nota guardada.');
      onNoteUpdated(); // Refresh sidebar to show new title
      fetchNote(); // Re-fetch to update state
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!note) {
    return <div className="flex items-center justify-center h-full"><p>Nota no encontrada.</p></div>;
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
          <Button size="sm" variant="outline" onClick={() => setViewMode(viewMode === 'split' ? 'editor' : 'split')}>
            {viewMode === 'split' ? <Code className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {viewMode === 'split' ? 'Editor' : 'Dividir'}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar
          </Button>
        </div>
      </div>
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {viewMode !== 'preview' && (
          <ResizablePanel defaultSize={viewMode === 'editor' ? 100 : 50}>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribe tu nota en Markdown..."
              className="h-full w-full border-none resize-none focus-visible:ring-0 focus-visible:ring-offset-0 p-4 font-mono"
            />
          </ResizablePanel>
        )}
        {viewMode === 'split' && <ResizableHandle withHandle />}
        {viewMode !== 'editor' && (
          <ResizablePanel defaultSize={viewMode === 'preview' ? 100 : 50}>
            <div className="prose dark:prose-invert p-4 h-full overflow-y-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          </ResizablePanel>
        )}
      </ResizablePanelGroup>
    </div>
  );
}