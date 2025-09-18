"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Server, Dock, HardDrive, Link } from 'lucide-react'; // Changed Docker to Dock
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from './ui/scroll-area';

interface RegisteredServer {
  id: string;
  name?: string;
  ip_address: string;
}

interface ServerDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: RegisteredServer;
}

// Placeholder components for server detail tabs
function ServerDetailDockerTab({ serverId }: { serverId: string }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Dock className="h-5 w-5" /> Contenedores Docker {/* Changed Docker to Dock */}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Mostrando contenedores Docker para el servidor: {serverId}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          (Listado de contenedores, estado, etc. en desarrollo)
        </p>
      </CardContent>
    </Card>
  );
}

function ServerDetailResourcesTab({ serverId }: { serverId: string }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" /> Uso de Recursos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Mostrando uso de CPU, RAM, Disco para el servidor: {serverId}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          (Gráficos y métricas en desarrollo)
        </p>
      </CardContent>
    </Card>
  );
}

function ServerDetailWebLinksTab({ serverId }: { serverId: string }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link className="h-5 w-5" /> Enlaces Web
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Mostrando enlaces a aplicaciones web desplegadas en el servidor: {serverId}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          (Listado de URLs y estados en desarrollo)
        </p>
      </CardContent>
    </Card>
  );
}


export function ServerDetailDialog({ open, onOpenChange, server }: ServerDetailDialogProps) {
  const [activeTab, setActiveTab] = useState('docker');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] p-6 h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-6 w-6" /> Detalles del Servidor: {server.name || server.ip_address}
          </DialogTitle>
          <DialogDescription>
            Información detallada y gestión avanzada para el servidor {server.ip_address}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 py-4 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="docker" className="flex items-center gap-2">
                <Dock className="h-4 w-4" /> Docker {/* Changed Docker to Dock */}
              </TabsTrigger>
              <TabsTrigger value="resources" className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" /> Recursos
              </TabsTrigger>
              <TabsTrigger value="weblinks" className="flex items-center gap-2">
                <Link className="h-4 w-4" /> Web
              </TabsTrigger>
            </TabsList>
            <div className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-full w-full">
                <TabsContent value="docker" className="h-full">
                  <ServerDetailDockerTab serverId={server.id} />
                </TabsContent>
                <TabsContent value="resources" className="h-full">
                  <ServerDetailResourcesTab serverId={server.id} />
                </TabsContent>
                <TabsContent value="weblinks" className="h-full">
                  <ServerDetailWebLinksTab serverId={server.id} />
                </TabsContent>
              </ScrollArea>
            </div>
          </Tabs>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}