"use client";

import { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface TextAnimatorProps {
  text: string;
  className?: string;
  isNew?: boolean;
  onAnimationComplete?: () => void;
  animationSpeed: 'slow' | 'normal' | 'fast';
}

export function TextAnimator({ text, className, isNew, onAnimationComplete }: TextAnimatorProps) {
  useEffect(() => {
    if (isNew) {
      onAnimationComplete?.();
    }
  }, [isNew, onAnimationComplete]);

  // Heurística para detectar si el texto contiene elementos de Markdown que necesitan estilo.
  // Esto evita aplicar estilos de 'prose' a texto simple de una sola línea.
  // Busca: Títulos (###), listas (* o -), negrita/cursiva (** o __), código en línea (`), enlaces, o múltiples saltos de línea.
  const containsMarkdown = /(^#{1,6}\s)|(^\s*[\*\-]\s)|(\*\*|__)|(`[^`]+`)|(\[.*\]\(.*\))|(\n.*\n)/m.test(text);

  if (containsMarkdown) {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    );
  }

  return <span className={className}>{text}</span>;
}