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
  aiResponseSpeed: 'slow' | 'normal' | 'fast'; // New prop for AI response speed
}

// Adjusted regex to be more flexible with whitespace and newlines,
// specifically expecting one or more newline characters after the header and before the closing backticks.
const codeBlockRegex = /```(\w+)(?::([\w./-]+))?\s*[\r\n]+([\s\S]*?)[\r\n]+\s*```/g;

export function MessageContent({ content, isNew, aiResponseSpeed }: MessageContentProps) {
  const [animatedPartsCount, setAnimatedPartsCount] = useState(0);

  // Parse content into a flat array of renderable parts
  const renderableParts = React.useMemo(() => {
    console.log("MessageContent: Type of content received:", typeof content);
    if (typeof content === 'string') {
      const parsedParts: Array<{ type: 'text' | 'code'; value?: string; language?: string; filename?: string; code?: string; }> = [];
      let lastIndex = 0;
      let match;
      
      codeBlockRegex.lastIndex = 0; // Reset regex for each text part

      while ((match = codeBlockRegex.exec(content)) !== null) {
        console.log("MessageContent: Regex match found:", match);
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
      console.log("MessageContent: Content is an array, not parsing for code blocks within string.");
      // If content is already an array of PuterContentPart, ensure it's mapped to RenderablePart
      return content.map(part => {
        if (part.type === 'text') return part as PuterTextContentPart;
        if (part.type === 'image_url') return part as PuterImageContentPart;
        // If there are other types in PuterContentPart that should be handled, add them here.
        // For now, assuming only text and image_url come from Puter directly.
        // If Puter AI starts returning code blocks as structured parts, this needs adjustment.
        return { type: 'text', text: JSON.stringify(part) } as PuterTextContentPart; // Fallback
      });
    }
    return [];
  }, [content]);

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
          animationSpeed={aiResponseSpeed} // Pass speed
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
          animationSpeed={aiResponseSpeed} // Pass speed
        />
      );
    }
    return null;
  };

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