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
      className={cn("relative w-full overflow-hidden", className)}
      style={{ padding: `${thickness}px` }}
    >
      <div
        className="absolute w-[300%] h-[50%] opacity-20 group-focus-within:opacity-70 bottom-[-11px] right-[-250%] rounded-full animate-star-movement-bottom z-0 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      />
      <div
        className="absolute w-[300%] h-[50%] opacity-20 group-focus-within:opacity-70 top-[-10px] left-[-250%] rounded-full animate-star-movement-top z-0 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      />
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
}