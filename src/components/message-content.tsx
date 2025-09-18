"use client";

import React from 'react';
import { CodeBlock } from './code-block';
import { TextAnimator } from './text-animator';

interface MessageContentProps {
  content: string;
  isNew?: boolean;
}

const codeBlockRegex = /```(\w+)(?::([\w./-]+))?\n(?:\[(.*?)\]\n)?([\s\S]*?)\n```/g;

export function MessageContent({ content, isNew }: MessageContentProps) {
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text' as const,
        value: content.substring(lastIndex, match.index),
      });
    }

    parts.push({
      type: 'code' as const,
      language: match[1],
      filename: match[2],
      summary: match[3],
      code: (match[4] || '').trim(),
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({
      type: 'text' as const,
      value: content.substring(lastIndex),
    });
  }

  if (parts.length === 0) {
    parts.push({ type: 'text' as const, value: content });
  }

  return (
    <>
      {parts.map((part, index) => {
        if (part.type === 'code') {
          return (
            <CodeBlock
              key={index}
              language={part.language || ''}
              filename={part.filename}
              summary={part.summary}
              code={part.code}
              isNew={isNew}
            />
          );
        }
        return isNew ? (
          <TextAnimator key={index} text={part.value} className="whitespace-pre-wrap" />
        ) : (
          <span key={index} className="whitespace-pre-wrap">{part.value}</span>
        );
      })}
    </>
  );
}