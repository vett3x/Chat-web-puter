"use client";

import React, { useState, useEffect } from 'react';
import { CodeBlock } from './code-block';
import { TextAnimator } from './text-animator';
import Image from 'next/image';

// New types for multimodal content
interface PuterTextContentPart {
  type: 'text';
  text: string;
}

interface PuterImageContentPart {
  type: 'image_url';
  image_url: {
    url: string; // Can be data URL (base64) or public URL
  };
}

// Define a specific type for code block parts
interface CodeBlockPart {
  type: 'code';
  language?: string;
  filename?: string;
  code: string;
}

// Union type for all possible renderable parts
type RenderablePart = PuterTextContentPart | PuterImageContentPart | CodeBlockPart;

interface MessageContentProps {
  content: string | RenderablePart[]; // Updated to allow array of parts
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

  // The component now expects pre-parsed parts. The string parsing is done in the useChat hook.
  const renderableParts = React.useMemo(() => {
    if (Array.isArray(content)) {
      return content;
    }
    // If it's a string, it's a simple text message or a plan that doesn't need parsing here.
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
    setTimeout(() => {
      setAnimatedPartsCount(prev => prev + 1);
    }, 100);
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