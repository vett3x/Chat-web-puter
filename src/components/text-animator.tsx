"use client";

import { useState, useEffect, useRef } from 'react';

interface TextAnimatorProps {
  text: string;
  className?: string;
  isNew?: boolean;
  onAnimationComplete?: () => void;
  animationSpeed: 'slow' | 'normal' | 'fast';
}

export function TextAnimator({ text, className, isNew, onAnimationComplete }: TextAnimatorProps) {
  // The streaming from useChat now handles the animation.
  // This component just needs to render the text as it receives it.
  // The onAnimationComplete is called by the stream handler in useChat when the stream ends.
  
  useEffect(() => {
    // If this component is part of a message that is NOT new (i.e., loaded from history),
    // and it's the last part of that message, we can consider its "animation" complete immediately.
    if (!isNew) {
      onAnimationComplete?.();
    }
  }, [isNew, onAnimationComplete]);

  return <span className={className}>{text}</span>;
}