"use client";

import React from 'react';
import { Wand2 } from 'lucide-react';

interface MobileHeaderProps {
  children: React.ReactNode;
}

export function MobileHeader({ children }: MobileHeaderProps) {
  return (
    <header className="flex items-center justify-between p-2 border-b bg-background flex-shrink-0 h-14 relative z-30">
      <div className="flex items-center gap-2">
        <Wand2 className="h-6 w-6 text-primary-light-purple" />
        <h1 className="text-lg font-semibold">DeepAI Coder</h1>
      </div>
      {children}
    </header>
  );
}