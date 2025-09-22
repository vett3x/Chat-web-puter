"use client";

import React from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface StatusMessage {
  message: string;
  type: 'info' | 'success' | 'error';
}

interface CreateContainerStatusProps {
  statusMessage: StatusMessage | null;
  currentStep: number;
  isTunnelConfigured: boolean;
}

export function CreateContainerStatus({ statusMessage, currentStep, isTunnelConfigured }: CreateContainerStatusProps) {
  if (!statusMessage) {
    return null;
  }

  const renderStatusStep = (stepNumber: number, message: string) => {
    const isActive = currentStep === stepNumber;
    const isCompleted = currentStep > stepNumber;
    const isError = statusMessage.type === 'error' && isActive;

    return (
      <div className="flex items-center gap-2 text-sm">
        {isError ? (
          <XCircle className="h-4 w-4 text-destructive" />
        ) : isCompleted ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : isActive ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <div className="h-4 w-4 border rounded-full flex-shrink-0" />
        )}
        <span className={isError ? "text-destructive" : isCompleted ? "text-muted-foreground" : ""}>
          {message}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-2 p-4 border rounded-md bg-muted/50">
      <h4 className="font-semibold">Progreso:</h4>
      {renderStatusStep(1, 'Iniciando proceso...')}
      {renderStatusStep(2, 'Verificando imagen Docker, creando contenedor e instalando Node.js/npm...')}
      {isTunnelConfigured && renderStatusStep(3, 'Configurando túnel Cloudflare...')}
      {statusMessage.type === 'error' && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <XCircle className="h-4 w-4" />
          <span>{statusMessage.message}</span>
        </div>
      )}
    </div>
  );
}