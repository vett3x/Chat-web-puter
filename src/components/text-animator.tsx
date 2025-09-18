"use client";

import { useState, useEffect, useRef } from 'react';

interface TextAnimatorProps {
  text: string;
  className?: string;
}

export function TextAnimator({ text, className }: TextAnimatorProps) {
  const [displayedText, setDisplayedText] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Limpiar siempre cualquier animación anterior para evitar superposiciones
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setDisplayedText('');
    if (text) {
      let i = 0;
      intervalRef.current = setInterval(() => {
        if (i < text.length) {
          // Usar substring es más seguro aquí, ya que no depende del estado anterior
          setDisplayedText(text.substring(0, i + 1));
          i++;
        } else if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      }, 25);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [text]);

  return <span className={className}>{displayedText}</span>;
}