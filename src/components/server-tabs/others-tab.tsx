"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings2 } from 'lucide-react';

export function OthersTab() {
  return (
    <div className="space-y-8 p-1">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-6 w-6" />
            Otras Configuraciones
          </CardTitle>
          <CardDescription>
            Aquí se ubicarán configuraciones adicionales y herramientas para la gestión de la aplicación.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Esta sección está en desarrollo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}