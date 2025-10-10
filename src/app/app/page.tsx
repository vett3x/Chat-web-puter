"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wand2 } from 'lucide-react';

export default function AppPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <Wand2 className="h-12 w-12 text-primary-light-purple mx-auto mb-4" />
          <CardTitle className="text-3xl font-bold">¡Bienvenido a la App!</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Esta es la página principal de tu aplicación.
            Aquí es donde se mostrará el contenido principal después de iniciar sesión.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            (Funcionalidad en desarrollo)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}