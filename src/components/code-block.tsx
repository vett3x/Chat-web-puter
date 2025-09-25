"use client";

import { useState, useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from '@/components/ui/button';
import { Check, Clipboard, Download, ChevronsUpDown, Loader2, CheckCircle2 } from 'lucide-react';
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
  const [isTyping, setIsTyping] = useState(!!isNew);

  // The streaming from useChat now handles the animation.
  // This component just needs to render the code as it receives it.
  // The onAnimationComplete is called by the stream handler in useChat when the stream ends.
  useEffect(() => {
    if (!isNew) {
      setIsTyping(false);
      onAnimationComplete?.();
    } else {
      // A simple heuristic: if the code length stops changing for a moment, assume typing is done.
      const timer = setTimeout(() => {
        setIsTyping(false);
        onAnimationComplete?.();
      }, 1000); // If no new code for 1 second, stop the typing indicator.
      return () => clearTimeout(timer);
    }
  }, [code, isNew, onAnimationComplete]);

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
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{ margin: 0, borderRadius: '0 0 0.5rem 0.5rem', background: '#1E1E1E' }}
          codeTagProps={{ style: { fontFamily: 'var(--font-geist-mono)' } }}
          wrapLongLines={true}
        >
          {code}
        </SyntaxHighlighter>
      </CollapsibleContent>
    </Collapsible>
  );
}