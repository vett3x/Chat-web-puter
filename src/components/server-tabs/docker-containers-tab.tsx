"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dock } from 'lucide-react'; // Changed Docker to Dock

export function DockerContainersTab() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Dock className="h-6 w-6" /> Contenedores Docker {/* Changed Docker to Dock */}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Aquí se mostrarán los contenedores Docker en tus servidores.
          Podrás ver su estado, recursos y gestionarlos.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          (Funcionalidad en desarrollo)
        </p>
      </CardContent>
    </Card>
  );
}