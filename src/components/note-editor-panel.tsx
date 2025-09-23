"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/session-context-provider';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, Loader2, Eye, Code } from 'lucide-react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import CodeEditor from '@uiw/react-textarea-code-editor';

interface Note {
  id: string;
  title: string;
  content: string | null;
  updated_at: string;
}

interface NoteEditorPanelProps {
  noteId: string;
  onNoteUpdated: () => void;
  noteFontSize: number;
  noteAutoSave: boolean;
}

export function NoteEditorPanel({ noteId, onNoteUpdated, noteFontSize, noteAutoSave }: NoteEditorPanelProps) {
  const { session } = useSession();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'editor' | 'split' | 'preview'>('editor');

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

  const handleSave = useCallback(async () => {
    if (!note || isSaving) return;
    setIsSaving(true);
    const { error } = await supabase
      .from('notes')
      .update({ title, content })
      .eq('id', note.id);

    if (error) {
      toast.error('Error al guardar la nota.');
    } else {
      toast.success('Nota guardada.');
      onNoteUpdated();
      setNote(prev => prev ? { ...prev, title, content, updated_at: new Date().toISOString() } : null);
    }
    setIsSaving(false);
  }, [note, title, content, isSaving, onNoteUpdated]);

  useEffect(() => {
    if (!noteAutoSave || isSaving || isLoading || !note) {
      return;
    }

    const hasChanges = title !== note.title || content !== (note.content || '');
    if (!hasChanges) {
      return;
    }

    const handler = setTimeout(() => {
      handleSave();
    }, 2000);

    return () => {
      clearTimeout(handler);
    };
  }, [title, content, note, noteAutoSave, isSaving, isLoading, handleSave]);

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
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => {
              if (value) setViewMode(value as 'editor' | 'split' | 'preview');
            }}
            className="h-9"
            aria-label="Modo de vista del editor"
          >
            <ToggleGroupItem value="editor" aria-label="Solo editor">
              <Code className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="split" aria-label="Vista dividida">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-split-square-horizontal"><path d="M8 12h8"/><path d="M12 18V6"/><rect width="18" height="18" x="3" y="3" rx="2"/></svg>
            </ToggleGroupItem>
            <ToggleGroupItem value="preview" aria-label="Solo vista previa">
              <Eye className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar
          </Button>
        </div>
      </div>
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {viewMode !== 'preview' && (
          <ResizablePanel defaultSize={viewMode === 'editor' ? 100 : 50} minSize={30}>
            <CodeEditor
              value={content}
              language="markdown"
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribe tu nota en Markdown..."
              padding={16}
              style={{
                fontSize: noteFontSize,
                backgroundColor: "hsl(var(--background))",
                fontFamily: 'var(--font-geist-mono)',
                height: '100%',
                overflow: 'auto',
                outline: 'none',
                border: 'none',
              }}
              className="w-full h-full"
            />
          </ResizablePanel>
        )}
        {viewMode === 'split' && <ResizableHandle withHandle />}
        {viewMode !== 'editor' && (
          <ResizablePanel defaultSize={viewMode === 'preview' ? 100 : 50} minSize={30}>
            <div className="prose dark:prose-invert p-4 h-full overflow-y-auto w-full max-w-none">
              {content.trim() === '' ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>La vista previa aparecerá aquí.</p>
                </div>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              )}
            </div>
          </ResizablePanel>
        )}
      </ResizablePanelGroup>
    </div>
  );
}