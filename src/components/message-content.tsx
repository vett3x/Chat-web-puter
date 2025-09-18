"use client";

import React, { useState, useEffect } from 'react';
import { CodeBlock } from './code-block';
import { TextAnimator } from './text-animator';

interface MessageContentProps {
  content: string;
  isNew?: boolean;
}

const codeBlockRegex = /```(\w+)(?::([\w./-]+))?\n([\s\S]*?)\n```/g;

export function MessageContent({ content, isNew }: MessageContentProps) {
  const [animatedPartsCount, setAnimatedPartsCount] = useState(0);

  // Parse on every render. Using useMemo to avoid re-parsing on every state change within this component.
  const parts = React.useMemo(() => {
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
    return parsedParts;
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
        {parts.map((part, index) => {
          if (part.type === 'code') {
            return <CodeBlock key={index} language={part.language || ''} filename={part.filename} code={part.code || ''} />;
          }
          return <span key={index} className="whitespace-pre-wrap">{part.value}</span>;
        })}
      </>
    );
  }

  return (
    <>
      {parts.map((part, index) => {
        if (index > animatedPartsCount) {
          return null;
        }

        const isPartAnimating = index === animatedPartsCount;

        if (part.type === 'code') {
          return (
            <CodeBlock
              key={index}
              language={part.language || ''}
              filename={part.filename}
              code={part.code || ''}
              isNew={isPartAnimating}
              onAnimationComplete={handlePartAnimationComplete}
            />
          );
        }
        return (
          <TextAnimator
            key={index}
            text={part.value || ''}
            className="whitespace-pre-wrap"
            isNew={isPartAnimating}
            onAnimationComplete={handlePartAnimationComplete}
          />
        );
      })}
    </>
  );
}