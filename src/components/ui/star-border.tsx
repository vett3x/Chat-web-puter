"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface StarBorderProps {
  children: React.ReactNode;
  className?: string;
  color?: string;
  speed?: React.CSSProperties['animationDuration'];
}

export function StarBorder({
  children,
  className,
  color = 'hsl(var(--primary-light-purple))',
  speed = '6s',
}: StarBorderProps) {
  return (
    <div className={cn("relative w-full h-full group", className)}>
      {/* The static border element that changes color on focus */}
      <div className="absolute inset-0 rounded-xl border border-[var(--chat-bubble-border-color)] group-focus-within:border-primary-light-purple transition-colors duration-300 pointer-events-none" />
      
      {/* Star 1 */}
      <div
        className="absolute h-3 w-3 rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none animate-star-orbit-clockwise"
        style={{
          background: `radial-gradient(circle, ${color} 10%, transparent 60%)`,
          animationDuration: speed,
        }}
      />
      {/* Star 2 */}
      <div
        className="absolute h-3 w-3 rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none animate-star-orbit-counter-clockwise"
        style={{
          background: `radial-gradient(circle, ${color} 10%, transparent 60%)`,
          animationDuration: speed,
          animationDelay: `-${parseFloat(speed) / 2}s`,
        }}
      />
      
      {/* The content */}
      <div className="relative w-full h-full">
        {children}
      </div>
    </div>
  );
}