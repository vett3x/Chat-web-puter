"use client";

import { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import BlurText from './blur-text';

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
    const delayMap = {
      slow: 150,
      normal: 100,
      fast: 50,
    };
    const delay = delayMap[animationSpeed] || 100;

    return (
      <BlurText
        text={text}
        delay={delay}
        animateBy="words"
        direction="top"
        onAnimationComplete={onAnimationComplete}
        className={className}
      />
    );
  }

  // Fallback for old messages or messages with complex markdown
  useEffect(() => {
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