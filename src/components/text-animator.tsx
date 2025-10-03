"use client";

import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SplitText from "./split-text"; // Cambiado de BlurText a SplitText

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
  const shouldUseSplitText = isNew && !containsMarkdown && !disableAnimation;

  useEffect(() => {
    if (isNew && !shouldUseSplitText) {
      onAnimationComplete?.();
    }
  }, [isNew, shouldUseSplitText, onAnimationComplete]);

  if (shouldUseSplitText) {
    const delayMap = {
      slow: 150,
      normal: 100,
      fast: 50,
    };
    const delay = delayMap[animationSpeed] || 100;

    return (
      <SplitText
        text={text}
        className={className}
        onLetterAnimationComplete={onAnimationComplete}
        delay={delay}
        duration={0.6}
        ease="power3.out"
        splitType="chars"
        from={{ opacity: 0, y: 20 }}
        to={{ opacity: 1, y: 0 }}
        textAlign="left"
      />
    );
  }

  if (containsMarkdown) {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    );
  }

  return <span className={className}>{text}</span>;
}