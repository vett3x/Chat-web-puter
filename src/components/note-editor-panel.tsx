"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/session-context-provider';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, Loader2, Eye, Code, Wand2, X, Settings, Sparkles } from 'lucide-react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import CodeEditor from '@uiw/react-textarea-code-editor';
import { NoteAiChat, ChatMessage } from './note-ai-chat';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CodeBlock } from './code-block';

interface Note {
  id: string;
  title: string;
  content: string | null;
  updated_at: string;
  chat_history: ChatMessage[] | null;
}

interface NoteEditorPanelProps {
  noteId: string;
  onNoteUpdated: () => void;
}

export function NoteEditorPanel({ noteId, onNoteUpdated }: NoteEditorPanelProps) {
  const { session } = useSession();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'editor' | 'split' | 'preview'>('editor');
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [showAiHint, setShowAiHint] = useState(false);

  // State for note settings
  const [noteFontSize, setNoteFontSize] = useState<number>(16);
  const [noteAutoSave, setNoteAutoSave] = useState<boolean>(true);

  // State for code formatting popover
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [isCodeFormatPopoverOpen, setIsCodeFormatPopoverOpen] = useState(false);
  const [codeLang, setCodeLang] = useState('');
  const [codeFilename, setCodeFilename] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedFontSize = localStorage.getItem('noteFontSize');
    if (savedFontSize) setNoteFontSize(Number(savedFontSize));
    const savedAutoSave = localStorage.getItem('noteAutoSave');
    if (savedAutoSave) setNoteAutoSave(savedAutoSave === 'true');
  }, []);

  useEffect(() => { localStorage.setItem('noteFontSize', String(noteFontSize)); }, [noteFontSize]);
  useEffect(() => { localStorage.setItem('noteAutoSave', String(noteAutoSave)); }, [noteAutoSave]);

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

  useEffect(() => { fetchNote(); }, [fetchNote]);

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
    if (!note || isSaving) return;
    setIsSaving(true);
    const { error } = await supabase.from('notes').update({ title, content }).eq('id', note.id);
    if (error) {
      toast.error('Error al guardar la nota.');
    } else {
      toast.success('Nota guardada.');
      onNoteUpdated();
      setNote(prev => prev ? { ...prev, title, content, updated_at: new Date().toISOString() } : null);
    }
    setIsSaving(false);
  }, [note, title, content, isSaving, onNoteUpdated]);

  const handleSaveChatHistory = useCallback(async (newHistory: ChatMessage[]) => {
    if (!note) return;
    const { error } = await supabase.from('notes').update({ chat_history: newHistory }).eq('id', note.id);
    if (error) {
      toast.error('Error al guardar el historial del chat.');
    } else {
      setNote(prev => prev ? { ...prev, chat_history: newHistory } : null);
    }
  }, [note]);

  useEffect(() => {
    if (!noteAutoSave || isSaving || isLoading || !note) return;
    const hasChanges = title !== note.title || content !== (note.content || '');
    if (!hasChanges) return;
    const handler = setTimeout(() => { handleSave(); }, 2000);
    return () => { clearTimeout(handler); };
  }, [title, content, note, noteAutoSave, isSaving, isLoading, handleSave]);

  const handleSelect = (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const { selectionStart, selectionEnd } = event.currentTarget;
    const selectedText = content.substring(selectionStart, selectionEnd);
    if (selectionEnd > selectionStart && selectedText.includes('\n')) {
      setSelection({ start: selectionStart, end: selectionEnd });
    } else {
      setSelection(null);
      setIsCodeFormatPopoverOpen(false);
    }
  };

  const handleFormatAsCode = () => {
    if (!selection) return;
    const selectedText = content.substring(selection.start, selection.end);
    const titleAttr = codeFilename ? ` title="${codeFilename}"` : '';
    const formattedCode = `\n\`\`\`${codeLang}${titleAttr}\n${selectedText}\n\`\`\`\n`;
    const newContent = content.substring(0, selection.start) + formattedCode + content.substring(selection.end);
    setContent(newContent);
    setSelection(null);
    setIsCodeFormatPopoverOpen(false);
    setCodeLang('');
    setCodeFilename('');
  };

  const markdownComponents = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const codeString = String(children).replace(/\n$/, '');
      if (!inline) {
        return <CodeBlock language={match ? match[1] : ''} filename={props.title} code={codeString} isNew={false} animationSpeed="normal" />;
      }
      return <code className="bg-muted text-muted-foreground font-mono text-sm px-1 py-0.5 rounded" {...props}>{children}</code>;
    },
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!note) {
    return <div className="flex items-center justify-center h-full"><p>Nota no encontrada.</p></div>;
  }

  return (
    <div className="h-full w-full flex flex-col bg-background relative" ref={editorRef}>
      <div className="flex items-center justify-between p-2 border-b bg-muted">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-lg font-semibold border-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent" disabled={isSaving} />
        <div className="flex items-center gap-2">
          <ToggleGroup type="single" value={viewMode} onValueChange={(value) => { if (value) setViewMode(value as 'editor' | 'split' | 'preview'); }} className="h-9" aria-label="Modo de vista del editor">
            <ToggleGroupItem value="editor" aria-label="Solo editor"><Code className="h-4 w-4" /></ToggleGroupItem>
            <ToggleGroupItem value="split" aria-label="Vista dividida"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-split-square-horizontal"><path d="M8 12h8"/><path d="M12 18V6"/><rect width="18" height="18" x="3" y="3" rx="2"/></svg></ToggleGroupItem>
            <ToggleGroupItem value="preview" aria-label="Solo vista previa"><Eye className="h-4 w-4" /></ToggleGroupItem>
          </ToggleGroup>
          <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9"><Settings className="h-4 w-4" /></Button></PopoverTrigger><PopoverContent className="w-64 p-4 space-y-4"><div className="space-y-2"><h4 className="font-medium leading-none">Configuración de Nota</h4><p className="text-sm text-muted-foreground">Ajustes específicos para este editor.</p></div><div className="space-y-4"><div className="flex items-center justify-between"><Label htmlFor="note-font-size">Tamaño de Fuente</Label><Input id="note-font-size" type="number" value={noteFontSize} onChange={(e) => setNoteFontSize(Number(e.target.value))} className="w-20" min={10} max={24} /></div><div className="flex items-center justify-between"><Label htmlFor="note-auto-save">Guardado Automático</Label><Switch id="note-auto-save" checked={noteAutoSave} onCheckedChange={setNoteAutoSave} /></div></div></PopoverContent></Popover>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Guardar</Button>
        </div>
      </div>
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {viewMode !== 'preview' && (<ResizablePanel defaultSize={viewMode === 'editor' ? 100 : 50} minSize={30}><CodeEditor value={content} language="markdown" onChange={(e) => setContent(e.target.value)} onSelect={handleSelect} placeholder="Escribe tu nota en Markdown..." padding={16} style={{ fontSize: noteFontSize, backgroundColor: "hsl(var(--background))", fontFamily: 'var(--font-geist-mono)', height: '100%', overflow: 'auto', outline: 'none', border: 'none' }} className="w-full h-full" /></ResizablePanel>)}
        {viewMode === 'split' && <ResizableHandle withHandle />}
        {viewMode !== 'editor' && (<ResizablePanel defaultSize={viewMode === 'preview' ? 100 : 50} minSize={30}><div className="prose dark:prose-invert p-4 h-full overflow-y-auto w-full max-w-none">{content.trim() === '' ? (<div className="flex items-center justify-center h-full text-muted-foreground"><p>La vista previa aparecerá aquí.</p></div>) : (<ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{content}</ReactMarkdown>)}</div></ResizablePanel>)}
      </ResizablePanelGroup>
      {selection && (
        <Popover open={isCodeFormatPopoverOpen} onOpenChange={setIsCodeFormatPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="absolute top-20 right-4 animate-in fade-in zoom-in-95" size="sm">
              <Sparkles className="h-4 w-4 mr-2 text-yellow-500" /> Formatear como Código
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="grid gap-4">
              <div className="space-y-2"><h4 className="font-medium leading-none">Formato de Código</h4><p className="text-sm text-muted-foreground">Define el lenguaje y el nombre del archivo.</p></div>
              <div className="grid gap-2">
                <div className="grid grid-cols-3 items-center gap-4"><Label htmlFor="language">Lenguaje</Label><Input id="language" value={codeLang} onChange={(e) => setCodeLang(e.target.value)} placeholder="python" className="col-span-2 h-8" /></div>
                <div className="grid grid-cols-3 items-center gap-4"><Label htmlFor="filename">Archivo</Label><Input id="filename" value={codeFilename} onChange={(e) => setCodeFilename(e.target.value)} placeholder="script.py" className="col-span-2 h-8" /></div>
              </div>
              <Button onClick={handleFormatAsCode}>Formatear</Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
      {showAiHint && (<div className="absolute bottom-20 right-4 bg-info text-info-foreground p-2 rounded-md shadow-lg text-sm animate-in fade-in slide-in-from-bottom-2 flex items-center gap-2 z-10"><span>¡Usa la IA para chatear con tu nota!</span><Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setShowAiHint(false)}><X className="h-3 w-3" /></Button></div>)}
      <Button variant="destructive" size="icon" onClick={() => setIsAiChatOpen(prev => !prev)} className="absolute bottom-4 right-4 rounded-full h-12 w-12 animate-pulse-red z-10" title="Asistente de Nota"><Wand2 className="h-6 w-6" /></Button>
      <NoteAiChat isOpen={isAiChatOpen} onClose={() => setIsAiChatOpen(false)} noteTitle={title} noteContent={content} initialChatHistory={note.chat_history} onSaveHistory={handleSaveChatHistory} />
    </div>
  );
}