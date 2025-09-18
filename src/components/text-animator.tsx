"use client";

import { useState, useEffect, useRef } from 'react';

interface TextAnimatorProps {
  text: string;
  className?: string;
  isNew?: boolean;
  onAnimationComplete?: () => void;
}

export function TextAnimator({ text, className, isNew, onAnimationComplete }: TextAnimatorProps) {
  const [displayedText, setDisplayedText] = useState(isNew ? '' : text);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isNew) {
      setDisplayedText(text);
      return;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setDisplayedText('');
    if (text) {
      let i = 0;
      intervalRef.current = setInterval(() => {
        if (i < text.length) {
          setDisplayedText(text.substring(0, i + 1));
          i++;
        } else {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          onAnimationComplete?.();
        }
      }, 25);
    } else {
      onAnimationComplete?.();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [text, isNew, onAnimationComplete]);

  return <span className={className}>{displayedText}</span>;
}