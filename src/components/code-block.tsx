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
  animationSpeed: 'slow' | 'normal' | 'fast'; // New prop
}

const SPEED_CONFIG = {
  slow: { targetCharsPerSecond: 1500, chunkSize: 20, minDelay: 2 },
  normal: { targetCharsPerSecond: 3000, chunkSize: 30, minDelay: 1 },
  fast: { targetCharsPerSecond: 5000, chunkSize: 40, minDelay: 0.5 },
};

export function CodeBlock({ language, code, filename, isNew, onAnimationComplete, animationSpeed }: CodeBlockProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [displayedCode, setDisplayedCode] = useState(isNew ? '' : code);
  const [isTyping, setIsTyping] = useState(!!isNew);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!isNew) {
      setDisplayedCode(code);
      setIsTyping(false);
      return;
    }

    setIsTyping(true);
    setDisplayedCode('');
    
    if (code) {
      const { targetCharsPerSecond, chunkSize, minDelay } = SPEED_CONFIG[animationSpeed];
      const MAX_DURATION = 6000; // Max duration remains constant

      const totalDuration = Math.min(
        (code.length / targetCharsPerSecond) * 1000,
        MAX_DURATION
      );
      
      const numberOfChunks = Math.ceil(code.length / chunkSize);
      const delayPerChunk = Math.max(totalDuration / numberOfChunks, minDelay);

      let i = 0;
      const typeChunk = () => {
        if (i < code.length) {
          const nextI = Math.min(i + chunkSize, code.length);
          setDisplayedCode(code.substring(0, nextI));
          i = nextI;
          timeoutRef.current = setTimeout(typeChunk, delayPerChunk);
        } else {
          setIsTyping(false);
          onAnimationComplete?.(); // Animation finished
        }
      };
      typeChunk();
    } else {
      setIsTyping(false);
      onAnimationComplete?.(); // No code to animate
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [code, isNew, onAnimationComplete, animationSpeed]);

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
          {displayedCode}
        </SyntaxHighlighter>
      </CollapsibleContent>
    </Collapsible>
  );
}