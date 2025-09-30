"use client";

import React from 'react';
import { ServerListTab } from './server-list-tab';
import { AllDockerContainersTab } from './all-docker-containers-tab';
import { UsageHistoryTab } from './usage-history-tab';
import { CloudflareTunnelTab } from './cloudflare-tunnel-tab';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wand2 } from 'lucide-react';

export function InfrastructureTab() {
  return (
    <div className="space-y-8 p-1">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-6 w-6 text-primary-light-purple" />
            Configuración de Aprovisionamiento de DeepAI Coder
          </CardTitle>
          <CardDescription>
            Estos son los parámetros base que DeepAI Coder utiliza para crear nuevos contenedores de aplicaciones. Las cuotas se basan en el perfil del usuario que crea la aplicación.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="font-semibold mb-2">Plantilla del Comando `docker run`:</p>
          <div className="bg-muted p-4 rounded-lg font-mono text-xs space-y-2 overflow-x-auto">
            <p><span className="text-purple-400">docker run -d</span> <span className="text-gray-400"># Ejecutar en segundo plano</span></p>
            <p>  <span className="text-purple-400">--name</span> [nombre-generado]</p>
            <p>  <span className="text-purple-400">-p</span> [puerto-aleatorio]:3000</p>
            <p>  <span className="text-purple-400">--cpus</span>="[limite_cpu_usuario]"</p>
            <p>  <span className="text-purple-400">--memory</span>="[limite_memoria_usuario]m"</p>
            <p>  <span className="text-purple-400">-e</span> DB_HOST=[...] <span className="text-gray-400"># Variables de entorno de la BD</span></p>
            <p>  <span className="text-purple-400">-v</span> [volumen-generado]:/app</p>
            <p>  <span className="text-purple-400">--entrypoint</span> tail node:lts-bookworm -f /dev/null</p>
          </div>
        </CardContent>
      </Card>
      <Separator />
      <ServerListTab />
      <Separator />
      <AllDockerContainersTab />
      <Separator />
      <CloudflareTunnelTab />
      <Separator />
      <UsageHistoryTab />
    </div>
  );
}