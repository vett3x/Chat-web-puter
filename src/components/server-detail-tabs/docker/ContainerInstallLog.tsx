"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollText, ChevronDown, ChevronRight } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ContainerInstallLogProps {
  log: string | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function ContainerInstallLog({ log, isOpen, onOpenChange }: ContainerInstallLogProps) {
  if (!log) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange} className="space-y-2 p-4 border rounded-md bg-muted/50">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold flex items-center gap-2">
          <ScrollText className="h-5 w-5" /> Log de Instalación del Contenedor
        </h4>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon" title={isOpen ? "Ocultar log" : "Mostrar log"} className="h-7 w-7">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="mt-2 border rounded-md overflow-hidden">
          <div className="max-h-[400px] overflow-auto">
            <SyntaxHighlighter
              language="bash"
              style={vscDarkPlus}
              customStyle={{ margin: 0, padding: '1rem', fontSize: '0.875rem', lineHeight: '1.25rem' }}
              codeTagProps={{ style: { fontFamily: 'var(--font-geist-mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' } }}
              wrapLines={true}
              wrapLongLines={true}
            >
              {log}
            </SyntaxHighlighter>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}