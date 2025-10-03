"use client";

import React, { useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface BlurTextProps {
  text: string;
  className?: string;
  isNew?: boolean;
  onAnimationComplete?: () => void;
}

export function BlurText({ text, className, isNew, onAnimationComplete }: BlurTextProps) {
  const words = useMemo(() => text.split(' '), [text]);
  const animationDelay = 0.05;
  const animationDuration = 0.1;

  useEffect(() => {
    if (isNew && onAnimationComplete) {
      const totalDuration = (words.length - 1) * animationDelay * 1000 + animationDuration * 1000;
      const timer = setTimeout(onAnimationComplete, totalDuration);
      return () => clearTimeout(timer);
    }
  }, [isNew, onAnimationComplete, words.length]);

  if (!isNew) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={cn("inline", className)}>
      {words.map((word, i) => (
        <span
          key={i}
          className="inline-block animate-blur-in"
          style={{ animationDelay: `${i * animationDelay}s` }}
        >
          {word}&nbsp;
        </span>
      ))}
    </span>
  );
}