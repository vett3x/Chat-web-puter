"use client";

import React from 'react';
import MagicBento from '@/components/MagicBento';
import { Button } from '@/components/ui/button';
import { Wand2 } from 'lucide-react';

export default function LandingPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-[#060010] text-white p-4 sm:p-8 overflow-hidden">
      <div className="text-center z-10 mb-12">
        <Wand2 className="h-12 w-12 mx-auto mb-4 text-primary-light-purple" />
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
          Crea y Despliega Aplicaciones con tu Copiloto de IA
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-lg text-white/70">
          La plataforma todo en uno que convierte tus ideas en software real. Escribe, gestiona y despliega, todo desde una única interfaz.
        </p>
        <div className="mt-8">
          <Button size="lg" className="bg-primary-light-purple hover:bg-primary-light-purple/90 text-white font-semibold text-lg px-8 py-6 rounded-full">
            Empezar a Construir Ahora
          </Button>
        </div>
      </div>

      <MagicBento 
        textAutoHide={true}
        enableStars={true}
        enableSpotlight={true}
        enableBorderGlow={true}
        enableTilt={true}
        enableMagnetism={true}
        clickEffect={true}
        spotlightRadius={300}
        particleCount={12}
        glowColor="132, 0, 255"
      />

      <div className="text-center z-10 mt-12">
        <h2 className="text-3xl font-bold">Planes Flexibles para Cada Necesidad</h2>
        <p className="mt-2 max-w-xl mx-auto text-white/70">
          Nuestros planes de suscripción están diseñados para crecer contigo, garantizando un servicio de primera, seguro y en constante mejora.
        </p>
      </div>

      <footer className="mt-16 text-center text-white/50 text-sm">
        <p>&copy; {new Date().getFullYear()} DeepAI Coder. Todos los derechos reservados.</p>
      </footer>
    </main>
  );
}