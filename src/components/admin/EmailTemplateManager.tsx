"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Clipboard, Check } from 'lucide-react';
import { toast } from 'sonner';
import CodeEditor from '@uiw/react-textarea-code-editor';
import { useTheme } from 'next-themes';

const templates = [
  { id: 'welcome', name: 'Correo de Bienvenida' },
  { id: 'reset-password', name: 'Restablecimiento de Contraseña' },
];

export function EmailTemplateManager() {
  const { resolvedTheme } = useTheme();
  const [selectedTemplate, setSelectedTemplate] = useState<string>(templates[0].id);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  const fetchTemplateContent = useCallback(async (templateId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/emails/render?template=${templateId}`);
      if (!response.ok) {
        throw new Error('No se pudo cargar la plantilla del correo.');
      }
      const html = await response.text();
      setHtmlContent(html);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplateContent(selectedTemplate);
  }, [selectedTemplate, fetchTemplateContent]);

  const handleCopy = () => {
    navigator.clipboard.writeText(htmlContent);
    toast.success('Código HTML copiado al portapapeles.');
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Selecciona una plantilla" />
          </SelectTrigger>
          <SelectContent>
            {templates.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleCopy} disabled={!htmlContent}>
          {isCopied ? <Check className="mr-2 h-4 w-4" /> : <Clipboard className="mr-2 h-4 w-4" />}
          Copiar HTML
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium">Previsualización</h4>
            <div className="border rounded-md h-[500px] overflow-hidden">
              <iframe
                srcDoc={htmlContent}
                className="w-full h-full border-0"
                title="Previsualización del correo"
              />
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Código HTML</h4>
            <div className="border rounded-md h-[500px] overflow-auto" data-color-mode={resolvedTheme}>
              <CodeEditor
                value={htmlContent}
                language="html"
                readOnly
                padding={15}
                style={{
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-geist-mono)',
                  backgroundColor: 'var(--card-background)',
                  color: 'var(--card-foreground)',
                  height: '100%',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}