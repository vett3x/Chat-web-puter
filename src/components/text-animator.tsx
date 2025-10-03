"use client";

import { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BlurText } from './blur-text'; // Import the new CSS-based animation component

interface TextAnimatorProps {
  text: string;
  className?: string;
  isNew?: boolean;
  onAnimationComplete?: () => void;
  animationSpeed: 'slow' | 'normal' | 'fast';
}

export function TextAnimator({ text, className, isNew, onAnimationComplete, animationSpeed }: TextAnimatorProps) {
  const containsMarkdown = /(^#{1,6}\s)|(^\s*[\*\-]\s)|(\*\*|__)|(`[^`]+`)|(\[.*\]\(.*\))|(\n.*\n)/m.test(text);

  if (isNew && !containsMarkdown) {
    return (
      <BlurText
        text={text}
        className={className}
        isNew={isNew}
        onAnimationComplete={onAnimationComplete}
      />
    );
  }

  // For existing messages or markdown content, render immediately without animation.
  useEffect(() => {
    if (isNew && containsMarkdown) {
      onAnimationComplete?.();
    }
  }, [isNew, containsMarkdown, onAnimationComplete]);

  if (containsMarkdown) {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    );
  }

  return <span className={className}>{text}</span>;
}