"use client";

import React from 'react';
import { Loader2, Wand2, AlertTriangle } from 'lucide-react';
import { AutoFixStatus as AutoFixStatusType } from '@/types/chat';

interface AutoFixStatusProps {
  status: AutoFixStatusType;
}

export function AutoFixStatus({ status }: AutoFixStatusProps) {
  if (status === 'idle') {
    return null;
  }

  const statusConfig: Record<Exclude<AutoFixStatusType, 'idle'>, { icon: React.ReactNode; text: string; bgColor: string; }> = {
    analyzing: {
      icon: <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />,
      text: 'Compilación fallida. Analizando error...',
      bgColor: 'bg-yellow-900/50 border-yellow-700/50',
    },
    plan_ready: {
      icon: <Wand2 className="h-4 w-4 text-purple-400" />,
      text: 'Plan de corrección listo. Revisa el chat para aprobar.',
      bgColor: 'bg-purple-900/50 border-purple-700/50',
    },
    fixing: {
      icon: <Loader2 className="h-4 w-4 animate-spin text-blue-400" />,
      text: 'Aplicando corrección...',
      bgColor: 'bg-blue-900/50 border-blue-700/50',
    },
    failed: {
      icon: <AlertTriangle className="h-4 w-4 text-red-400" />,
      text: 'El arreglo automático falló. Se necesita intervención manual.',
      bgColor: 'bg-red-900/50 border-red-700/50',
    },
  };

  const currentStatus = statusConfig[status];

  if (!currentStatus) return null;

  return (
    <div className={`absolute bottom-24 left-1/2 -translate-x-1/2 w-auto max-w-md mx-auto z-10`}>
      <div className={`flex items-center gap-2 text-xs font-medium text-white px-3 py-1.5 rounded-full border backdrop-blur-sm ${currentStatus.bgColor}`}>
        {currentStatus.icon}
        <span>{currentStatus.text}</span>
      </div>
    </div>
  );
}