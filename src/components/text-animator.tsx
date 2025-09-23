"use client";

import { useState, useEffect, useRef } from 'react';

interface TextAnimatorProps {
  text: string;
  className?: string;
  isNew?: boolean;
  onAnimationComplete?: () => void;
  animationSpeed: 'slow' | 'normal' | 'fast'; // New prop
}

const SPEED_DELAYS = {
  slow: 15,
  normal: 7,
  fast: 2,
};

export function TextAnimator({ text, className, isNew, onAnimationComplete, animationSpeed }: TextAnimatorProps) {
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
      const delay = SPEED_DELAYS[animationSpeed];
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
      }, delay);
    } else {
      onAnimationComplete?.();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [text, isNew, onAnimationComplete, animationSpeed]);

  return <span className={className}>{displayedText}</span>;
}