"use client";

import React, { useState, useEffect } from 'react';
import CodeEditor from '@uiw/react-textarea-code-editor';
import { Button } from '@/components/ui/button';
import { Save, X, Loader2, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface CodeEditorPanelProps {
  appId: string;
  file: { path: string; content: string };
  onClose: () => void;
  onSwitchToPreview: () => void;
}

export function CodeEditorPanel({ appId, file, onClose, onSwitchToPreview }: CodeEditorPanelProps) {
  const [code, setCode] = useState(file.content);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setCode(file.content);
  }, [file]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/apps/${appId}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: file.path, content: code }),
      });
      if (!response.ok) throw new Error('No se pudo guardar el archivo.');
      toast.success(`Archivo ${file.path} guardado.`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getLanguage = (path: string) => {
    const extension = path.split('.').pop() || '';
    switch (extension) {
      case 'js':
      case 'jsx':
        return 'jsx';
      case 'ts':
      case 'tsx':
        return 'tsx';
      case 'css':
        return 'css';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      default:
        return 'tsx';
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-background">
      <div className="flex items-center justify-between p-2 border-b bg-muted">
        <span className="font-mono text-sm">{file.path}</span>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar
          </Button>
          <Button size="sm" variant="outline" onClick={onSwitchToPreview}>
            <Eye className="h-4 w-4 mr-2" />
            Vista Previa
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <CodeEditor
          value={code}
          language={getLanguage(file.path)}
          onChange={(e) => setCode(e.target.value)}
          padding={15}
          style={{
            fontSize: 14,
            backgroundColor: "hsl(var(--background))",
            fontFamily: 'var(--font-geist-mono)',
            height: '100%',
            overflow: 'auto',
          }}
        />
      </div>
    </div>
  );
}