"use client";

import { useState, useEffect, useRef } from 'react';

interface TextAnimatorProps {
  text: string;
  className?: string;
  isNew?: boolean; // Indicates if this part is currently being "animated" (i.e., just appeared)
  onAnimationComplete?: () => void;
  animationSpeed: 'slow' | 'normal' | 'fast'; // Not directly used for text animation, but kept for consistency
}

export function TextAnimator({ text, className, isNew, onAnimationComplete }: TextAnimatorProps) {
  useEffect(() => {
    if (isNew) {
      // For text parts, we consider the "animation" complete as soon as they are rendered.
      // The actual streaming effect is handled by the parent updating the 'text' prop.
      // We just need to signal to the parent that this part is done, so the next can start.
      onAnimationComplete?.();
    }
  }, [isNew, onAnimationComplete]); // Depend on isNew to trigger when this part becomes active

  return <span className={className}>{text}</span>;
}