"use client";

import { useState, useEffect } from 'react';
import CodeEditor from '@uiw/react-textarea-code-editor';
import { Button } from '@/components/ui/button';
import { Check, Clipboard, Download, ChevronsUpDown, Loader2, CheckCircle2, Terminal } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  language: string;
  code: string;
  filename?: string;
  isNew?: boolean;
  onAnimationComplete?: () => void;
  animationSpeed: 'slow' | 'normal' | 'fast';
}

export function CodeBlock({ language, code, filename, isNew, onAnimationComplete }: CodeBlockProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (isNew) {
      setIsTyping(true);
      const timer = setTimeout(() => {
        setIsTyping(false);
        onAnimationComplete?.();
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setIsTyping(false);
    }
  }, [isNew, onAnimationComplete]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setIsCopied(true);
      toast.success('Código copiado al portapapeles.');
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const extensionMap: { [key: string]: string } = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      html: 'html',
      css: 'css',
      tsx: 'tsx',
      jsx: 'jsx',
      json: 'json',
    };
    const extension = extensionMap[language] || 'txt';
    a.download = filename || `code.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Archivo ${a.download} descargado.`);
  };

  if (language === 'bash' && filename === 'exec') {
    return (
      <div className="rounded-lg border bg-muted/50 my-2 p-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Terminal className="h-5 w-5 flex-shrink-0" />
        <span>Comando de Terminal (ejecutado automáticamente al aprobar el plan)</span>
      </div>
    );
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn(
        "rounded-lg border bg-muted/50 my-2 transition-all duration-300",
        isTyping && "border-warning shadow-[0_0_10px_1px_hsl(var(--warning))]"
      )}
    >
      <div className="flex items-center justify-between p-2 pl-4 bg-muted/80 rounded-t-lg">
        <div className="flex items-center gap-2 overflow-hidden">
          {isTyping ? (
            <Loader2 className="h-4 w-4 animate-spin text-warning flex-shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
          )}
          <span className="text-sm font-mono truncate">{filename || `${language} code`}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleDownload} className="h-7 w-7">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleCopy} className="h-7 w-7">
            {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Clipboard className="h-4 w-4" />}
          </Button>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <ChevronsUpDown className="h-4 w-4" />
              <span className="sr-only">Toggle</span>
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>
      <CollapsibleContent>
        <CodeEditor
          value={code}
          language={language}
          padding={15}
          readOnly
          style={{
            fontSize: 14,
            backgroundColor: '#1E1E1E',
            fontFamily: 'var(--font-geist-mono)',
            borderRadius: '0 0 0.5rem 0.5rem',
          }}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}