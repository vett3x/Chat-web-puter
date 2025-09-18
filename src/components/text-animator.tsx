"use client";

import { useState, useEffect } from 'react';

interface TextAnimatorProps {
  text: string;
  className?: string;
}

export function TextAnimator({ text, className }: TextAnimatorProps) {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    setDisplayedText('');
    if (text) {
      let i = 0;
      const intervalId = setInterval(() => {
        if (i < text.length) {
          setDisplayedText(text.substring(0, i + 1));
          i++;
        } else {
          clearInterval(intervalId);
        }
      }, 15); // Velocidad de escritura ajustada para ser rápida y fluida

      return () => clearInterval(intervalId);
    }
  }, [text]);

  return <span className={className}>{displayedText}</span>;
}