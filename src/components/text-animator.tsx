"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TextGenerateEffect } from './ui/text-generate-effect';

interface TextAnimatorProps {
  text: string;
  className?: string;
  isNew?: boolean;
  onAnimationComplete?: () => void;
  animationSpeed: 'slow' | 'normal' | 'fast';
  disableAnimation?: boolean;
}

export function TextAnimator({ text, className, isNew, onAnimationComplete, animationSpeed, disableAnimation }: TextAnimatorProps) {
  const containsMarkdown = /(^#{1,6}\s)|(^\s*[\*\-]\s)|(\*\*|__)|(`[^`]+`)|(\[.*\]\(.*\))|(\n.*\n)/m.test(text);

  if (isNew && !containsMarkdown && !disableAnimation) {
    return (
      <TextGenerateEffect
        words={text}
        className={className}
        onAnimationComplete={onAnimationComplete}
      />
    );
  }

  // Fallback for old messages or messages with complex markdown
  // Also call onAnimationComplete immediately if it's a new message but not animated
  React.useEffect(() => {
    if (isNew) {
      onAnimationComplete?.();
    }
  }, [isNew, onAnimationComplete]);

  if (containsMarkdown) {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    );
  }

  return <span className={className}>{text}</span>;
}