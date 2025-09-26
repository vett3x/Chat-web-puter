"use client";

import { useState, useEffect, useRef } from 'react';

interface TextAnimatorProps {
  text: string;
  className?: string;
  isNew?: boolean; // Indicates if this part is currently being "animated" (i.e., just appeared)
  onAnimationComplete?: () => void;
  animationSpeed: 'slow' | 'normal' | 'fast';
}

export function TextAnimator({ text, className, isNew, onAnimationComplete, animationSpeed }: TextAnimatorProps) {
  const [displayedText, setDisplayedText] = useState('');
  const indexRef = useRef(0);
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  const speedMap = {
    slow: 100,
    normal: 50,
    fast: 20,
  };
  const delay = speedMap[animationSpeed];

  useEffect(() => {
    if (isNew && text.length > 0) {
      setDisplayedText('');
      indexRef.current = 0;

      const animate = () => {
        if (indexRef.current < text.length) {
          setDisplayedText(prev => prev + text.charAt(indexRef.current));
          indexRef.current++;
          animationRef.current = setTimeout(animate, delay);
        } else {
          onAnimationComplete?.();
        }
      };
      animationRef.current = setTimeout(animate, delay);
    } else if (!isNew) {
      setDisplayedText(text); // If not new, just show full text
      onAnimationComplete?.(); // Immediately complete if not new
    }

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [text, isNew, delay, onAnimationComplete]);

  return <span className={className}>{displayedText}</span>;
}