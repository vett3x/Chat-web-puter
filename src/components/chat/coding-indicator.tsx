"use client";

import React from 'react';
import { Wand2 } from 'lucide-react';

export function CodingIndicator() {
  return (
    <div className="p-4 rounded-lg bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 bg-[length:200%_200%] animate-gradient-sweep">
      <div className="flex items-center gap-3 text-white">
        <Wand2 className="h-5 w-5 animate-pulse" />
        <div className="flex flex-col">
          <span className="font-semibold">Codeando...</span>
          <span className="text-xs opacity-80">Generando archivos para tu proyecto.</span>
        </div>
      </div>
    </div>
  );
}