"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { History } from 'lucide-react';

export function UsageHistoryTab() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-6 w-6" /> Historial de Uso
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Aquí se mostrará el historial de uso y despliegues en tus servidores.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          (Funcionalidad en desarrollo)
        </p>
      </CardContent>
    </Card>
  );
}