"use client";

import React from 'react';
import { Wand2, Loader2 } from 'lucide-react';

interface AppPreviewPanelProps {
  appUrl: string | null;
  appStatus: string | null;
}

export function AppPreviewPanel({ appUrl, appStatus }: AppPreviewPanelProps) {
  const renderContent = () => {
    if (appStatus === 'provisioning') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <h3 className="text-lg font-semibold">Aprovisionando Entorno</h3>
          <p>Creando contenedor, configurando dominio y desplegando la base de Next.js...</p>
          <p className="text-sm mt-2">(Esto puede tardar unos minutos)</p>
        </div>
      );
    }

    if (appUrl && appStatus === 'ready') {
      return (
        <iframe
          src={appUrl}
          title="App Preview"
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
        <Wand2 className="h-12 w-12 mb-4" />
        <h3 className="text-lg font-semibold">Vista Previa de la Aplicación</h3>
        <p>Selecciona una aplicación o crea una nueva para ver la vista previa en vivo aquí.</p>
      </div>
    );
  };

  return (
    <div className="h-full w-full bg-muted/30 flex flex-col">
      <div className="flex-1">
        {renderContent()}
      </div>
    </div>
  );
}