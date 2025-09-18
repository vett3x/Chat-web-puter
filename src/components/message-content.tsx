"use client";

import React, { useState, useEffect } from 'react';
import { CodeBlock } from './code-block';
import { TextAnimator } from './text-animator';
import Image from 'next/image'; // Importar el componente Image de Next.js

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

type PuterContentPart = PuterTextContentPart | PuterImageContentPart;

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
  content: string | PuterContentPart[]; // Updated to allow array of parts
  isNew?: boolean;
}

const codeBlockRegex = /```(\w+)(?::([\w./-]+))?\n([\s\S]*?)\n```/g;

export function MessageContent({ content, isNew }: MessageContentProps) {
  const [animatedPartsCount, setAnimatedPartsCount] = useState(0);

  // Helper to render a single part
  const renderPart = (part: RenderablePart, index: number, isAnimating: boolean, onComplete?: () => void) => {
    if (part.type === 'text') {
      const textValue = part.text;
      
      // Check for code blocks within text parts
      const textParts = [];
      let lastIndex = 0;
      let match;
      codeBlockRegex.lastIndex = 0; // Reset regex for each text part

      while ((match = codeBlockRegex.exec(textValue)) !== null) {
        if (match.index > lastIndex) {
          textParts.push({ type: 'text_segment', value: textValue.substring(lastIndex, match.index) });
        }
        textParts.push({
          type: 'code_block',
          language: match[1],
          filename: match[2],
          code: (match[3] || '').trim(),
        });
        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < textValue.length) {
        textParts.push({ type: 'text_segment', value: textValue.substring(lastIndex) });
      }

      if (textParts.length > 0) {
        return textParts.map((segment, segIndex) => {
          if (segment.type === 'code_block') {
            return (
              <CodeBlock
                key={`${index}-${segIndex}`}
                language={segment.language || ''}
                filename={segment.filename}
                code={segment.code || ''}
                isNew={isAnimating}
                onAnimationComplete={onComplete}
              />
            );
          }
          return (
            <TextAnimator
              key={`${index}-${segIndex}`}
              text={segment.value || ''}
              className="whitespace-pre-wrap"
              isNew={isAnimating}
              onAnimationComplete={onComplete}
            />
          );
        });
      }
      
      // If no code blocks, treat as a single text segment
      return (
        <TextAnimator
          key={index}
          text={textValue || ''}
          className="whitespace-pre-wrap"
          isNew={isAnimating}
          onAnimationComplete={onComplete}
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
    } else if (part.type === 'code') { // Handle CodeBlockPart directly
      return (
        <CodeBlock
          key={index}
          language={part.language || ''}
          filename={part.filename}
          code={part.code || ''}
          isNew={isAnimating}
          onAnimationComplete={onComplete}
        />
      );
    }
    return null;
  };

  // Parse content into a flat array of renderable parts
  const renderableParts = React.useMemo(() => {
    if (typeof content === 'string') {
      const parsedParts: Array<{ type: 'text' | 'code'; value?: string; language?: string; filename?: string; code?: string; }> = [];
      let lastIndex = 0;
      let match;
      
      codeBlockRegex.lastIndex = 0;

      while ((match = codeBlockRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
          parsedParts.push({
            type: 'text' as const,
            value: content.substring(lastIndex, match.index),
          });
        }
        parsedParts.push({
          type: 'code' as const,
          language: match[1],
          filename: match[2],
          code: (match[3] || '').trim(),
        });
        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < content.length) {
        parsedParts.push({
          type: 'text' as const,
          value: content.substring(lastIndex),
        });
      }

      if (parsedParts.length === 0 && content) {
        parsedParts.push({ type: 'text' as const, value: content });
      }
      // Map to the RenderablePart union type
      return parsedParts.map(p => {
        if (p.type === 'text') {
          return { type: 'text', text: p.value || '' } as PuterTextContentPart;
        }
        return {
          type: 'code',
          language: p.language,
          filename: p.filename,
          code: p.code || '',
        } as CodeBlockPart;
      });
    } else if (Array.isArray(content)) {
      return content;
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