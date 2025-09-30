"use client";

import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, Server, Dock, Package, Globe, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const provisioningSteps = [
  { text: "Asignando un servidor seguro en la nube...", icon: <Server className="h-5 w-5" /> },
  { text: "Creando un contenedor Docker aislado para tu proyecto...", icon: <Dock className="h-5 w-5" /> },
  { text: "Instalando Node.js, npm y otras herramientas mágicas...", icon: <Package className="h-5 w-5" /> },
  { text: "Configurando un túnel seguro de Cloudflare para el acceso web...", icon: <Globe className="h-5 w-5" /> },
  { text: "Generando la estructura inicial de tu aplicación Next.js...", icon: <Wand2 className="h-5 w-5" /> },
  { text: "¡Casi listo! Dando los toques finales...", icon: <Loader2 className="h-5 w-5 animate-spin" /> },
];

export function AppProvisioningChatPanel() {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const timers = provisioningSteps.map((_, index) => 
      setTimeout(() => {
        setCurrentStep(index + 1);
      }, (index + 1) * 2500) // Aumenta el tiempo entre pasos
    );

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex flex-col h-full bg-background items-center justify-center text-center p-8">
      <div className="max-w-md w-full">
        <h3 className="text-2xl font-semibold mb-8">Aprovisionando tu Entorno DeepAI Coder</h3>
        <div className="space-y-4 text-left">
          {provisioningSteps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isActive = index === currentStep;

            return (
              <div
                key={index}
                className={cn(
                  "flex items-center gap-3 transition-all duration-500",
                  isActive || isCompleted ? "opacity-100" : "opacity-40"
                )}
              >
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : isActive ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                  )}
                </div>
                <span className={cn("text-sm", isCompleted ? "text-muted-foreground line-through" : "text-foreground")}>
                  {step.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}