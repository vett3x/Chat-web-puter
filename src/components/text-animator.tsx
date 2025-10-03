"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { motion, Variants } from "framer-motion";

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

  // Si no es nuevo, o tiene markdown, o la animación está deshabilitada, renderiza sin efecto.
  if (!isNew || containsMarkdown || disableAnimation) {
    // Llama a onAnimationComplete inmediatamente si es un mensaje nuevo pero no se anima
    React.useEffect(() => {
      if (isNew) {
        onAnimationComplete?.();
      }
    }, [isNew, onAnimationComplete]);

    if (containsMarkdown) {
      return (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      );
    }
    return <span className={cn("whitespace-pre-wrap", className)}>{text}</span>;
  }

  // Lógica de animación para texto simple y nuevo
  const wordsArray = text.split(" ");

  const containerVariants: Variants = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.04,
      },
    },
  };

  const childVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: "easeOut",
      },
    },
  };

  return (
    <motion.div
      className={cn("whitespace-pre-wrap", className)}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      onAnimationComplete={onAnimationComplete}
    >
      {wordsArray.map((word, idx) => (
        <motion.span
          key={word + idx}
          variants={childVariants}
          className="inline-block"
        >
          {word}{" "}
        </motion.span>
      ))}
    </motion.div>
  );
}