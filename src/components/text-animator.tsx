"use client";

import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import BlurText from './blur-text';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface TextAnimatorProps {
  text: string;
  className?: string;
  isNew?: boolean;
  onAnimationComplete?: () => void;
  animationSpeed: 'slow' | 'normal' | 'fast';
}

export function TextAnimator({ text, className, isNew, onAnimationComplete, animationSpeed }: TextAnimatorProps) {
  const containsMarkdown = /(^#{1,6}\s)|(^\s*[\*\-]\s)|(\*\*|__)|(`[^`]+`)|(\[.*\]\(.*\))|(\n.*\n)/m.test(text);

  if (isNew) {
    if (containsMarkdown) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeIn" }}
          onAnimationComplete={onAnimationComplete}
          className="prose prose-sm dark:prose-invert max-w-none"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </motion.div>
      );
    } else {
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
  }

  // Fallback for old messages
  if (containsMarkdown) {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    );
  }

  return <span className={className}>{text}</span>;
}