"use client";

import React from 'react';
import Link from 'next/link';
import Noise from '@/components/Noise';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#060010] text-white">
      <Noise
        patternSize={250}
        patternScaleX={1}
        patternScaleY={1}
        patternRefreshInterval={2}
        patternAlpha={15}
      />
      <div className="z-10 flex flex-col items-center text-center">
        <h1 className="text-9xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
          404
        </h1>
        <h2 className="mt-4 text-2xl font-semibold">Página No Encontrada</h2>
        <p className="mt-2 text-white/70">
          Lo sentimos, la página que buscas no existe o ha sido movida.
        </p>
        <Button asChild className="mt-8 bg-primary-light-purple hover:bg-primary-light-purple/90 text-white">
          <Link href="/">Volver al Inicio</Link>
        </Button>
      </div>
    </div>
  );
}