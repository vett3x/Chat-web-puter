"use client";

import React from 'react';
import { cn } from '@/lib/utils';

type StarBorderProps<T extends React.ElementType> = React.ComponentPropsWithoutRef<T> & {
  as?: T;
  className?: string;
  children?: React.ReactNode;
  color?: string;
  speed?: React.CSSProperties['animationDuration'];
  thickness?: number;
  contentClassName?: string;
};

const StarBorder = <T extends React.ElementType = 'button'>({
  as,
  className = '',
  color = '#C000C0', // Color púrpura más cercano al de la imagen
  speed = '6s',
  thickness = 1,
  children,
  contentClassName,
  ...rest
}: StarBorderProps<T>) => {
  const Component = as || 'button';

  return (
    <Component
      className={cn(`relative inline-block overflow-hidden rounded-[20px]`, className)}
      {...(rest as any)}
      style={{
        padding: `${thickness}px 0`,
        ...(rest as any).style
      }}
    >
      {/* Estrella superior izquierda */}
      <div
        className="absolute w-[100px] h-[20px] opacity-70 top-[-10px] left-[-20px] rounded-full animate-star-movement-top z-0"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed
        }}
      ></div>
      {/* Estrella inferior derecha */}
      <div
        className="absolute w-[100px] h-[20px] opacity-70 bottom-[-10px] right-[-20px] rounded-full animate-star-movement-bottom z-0"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed
        }}
      ></div>
      {/* El contenido interno ahora se estiliza completamente a través de contentClassName */}
      <div className={cn("relative z-1", contentClassName)}>
        {children}
      </div>
    </Component>
  );
};

export default StarBorder;