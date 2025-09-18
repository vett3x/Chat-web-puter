"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cloud } from 'lucide-react';

export function CloudflareTunnelTab() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-6 w-6" /> Cloudflare Tunnel
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Aquí podrás configurar y gestionar Cloudflare Tunnels para tus servidores.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          (Funcionalidad en desarrollo)
        </p>
      </CardContent>
    </Card>
  );
}