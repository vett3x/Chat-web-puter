"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

export function UserListTab() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-6 w-6" /> Lista de Usuarios
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Aquí se mostrará la lista de usuarios registrados.
          Podrás ver sus roles y gestionarlos.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          (Funcionalidad en desarrollo)
        </p>
      </CardContent>
    </Card>
  );
}