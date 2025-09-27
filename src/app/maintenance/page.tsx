"use client";

import React from 'react';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function MaintenancePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <ShieldAlert className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <CardTitle className="text-3xl font-bold">Modo Mantenimiento</CardTitle>
          <CardDescription className="text-lg mt-2">
            Estamos realizando tareas de mantenimiento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            La aplicación no estará disponible temporalmente.
            Agradecemos tu paciencia y comprensión.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Volveremos pronto.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}