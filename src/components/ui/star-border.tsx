"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface StarBorderProps {
  children: React.ReactNode;
  className?: string;
  color?: string;
  speed?: React.CSSProperties['animationDuration'];
  thickness?: number;
}

export function StarBorder({
  children,
  className,
  color = 'hsl(var(--primary-light-purple))',
  speed = '6s',
  thickness = 1,
}: StarBorderProps) {
  return (
    <div
      className={cn(
        "relative inline-block overflow-hidden rounded-[20px] group",
        className
      )}
    >
      <div
        className="absolute w-[300%] h-[50%] opacity-0 group-focus-within:opacity-70 bottom-[-11px] right-[-250%] rounded-full animate-star-movement-bottom z-0 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      />
      <div
        className="absolute w-[300%] h-[50%] opacity-0 group-focus-within:opacity-70 top-[-10px] left-[-250%] rounded-full animate-star-movement-top z-0 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      />
      <div 
        className="relative z-10 bg-[var(--chat-bubble-background-color)] backdrop-blur-[var(--chat-bubble-blur)] border border-[var(--chat-bubble-border-color)] rounded-[20px] group-focus-within:border-primary-light-purple transition-colors duration-300"
        style={{
          borderWidth: `${thickness}px`,
        }}
      >
        {children}
      </div>
    </div>
  );
}