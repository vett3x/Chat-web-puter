"use client";

import React, { useState, useEffect } from 'react';
import { CodeBlock } from './code-block';
import { TextAnimator } from './text-animator';
import Image from 'next/image';
import { RenderablePart } from '@/lib/utils'; // Importar RenderablePart desde utils

interface MessageContentProps {
  content: string | RenderablePart[]; // MODIFICADO: Ahora acepta string o RenderablePart[]
  isNew?: boolean;
  aiResponseSpeed: 'slow' | 'normal' | 'fast';
  isAppChat?: boolean;
}

export function MessageContent({ content, isNew, aiResponseSpeed, isAppChat }: MessageContentProps) {
  const [animatedPartsCount, setAnimatedPartsCount] = useState(0);

  // Helper to render a single part
  const renderPart = (part: RenderablePart, index: number, isAnimating: boolean, onComplete?: () => void) => {
    if (part.type === 'text') {
      return (
        <TextAnimator
          key={index}
          text={part.text || ''}
          className="whitespace-pre-wrap"
          isNew={isAnimating}
          onAnimationComplete={onComplete}
          animationSpeed={aiResponseSpeed}
        />
      );
    } else if (part.type === 'image_url') {
      return (
        <div key={index} className="my-2 rounded-lg overflow-hidden max-w-xs border border-border">
          <Image
            src={part.image_url.url}
            alt="Contenido de imagen"
            width={300}
            height={300}
            objectFit="contain"
            className="w-full h-auto"
          />
        </div>
      );
    } else if (part.type === 'code') {
      return (
        <CodeBlock
          key={index}
          language={part.language || ''}
          filename={part.filename}
          code={part.code || ''}
          isNew={isAnimating}
          onAnimationComplete={onComplete}
          animationSpeed={aiResponseSpeed}
        />
      );
    }
    return null;
  };

  // El componente ahora espera partes pre-procesadas o una cadena.
  const renderableParts = React.useMemo(() => {
    if (Array.isArray(content)) {
      return content;
    }
    // Si es una cadena, la convertimos en una parte de texto simple.
    if (typeof content === 'string') {
        return [{ type: 'text', text: content }] as RenderablePart[];
    }
    return [];
  }, [content]);

  useEffect(() => {
    if (isNew) {
      setAnimatedPartsCount(0);
    }
  }, [isNew, content]);

  const handlePartAnimationComplete = () => {
    // No hay setTimeout aquí, la siguiente parte se anima inmediatamente
    // después de que la actual notifica su finalización.
    setAnimatedPartsCount(prev => prev + 1);
  };

  if (!isNew) {
    return (
      <>
        {renderableParts.map((part, index) => (
          renderPart(part, index, false)
        ))}
      </>
    );
  }

  return (
    <>
      {renderableParts.map((part, index) => {
        if (index > animatedPartsCount) {
          return null;
        }

        const isPartAnimating = index === animatedPartsCount;
        return renderPart(part, index, isPartAnimating, handlePartAnimationComplete);
      })}
    </>
  );
}