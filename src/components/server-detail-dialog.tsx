"use client";

import React, { useState } from 'react';
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
import { Server, Dock, HardDrive, Link, BarChart as BarChartIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

// Importar los nuevos componentes de pestaña
import { ServerDetailDockerTab } from '@/components/server-detail-tabs/server-detail-docker-tab';
import { ServerDetailResourcesTab } from '@/components/server-detail-tabs/server-detail-resources-tab';
import { ServerDetailWebLinksTab } from '@/components/server-detail-tabs/server-detail-web-links-tab';
import { ServerDetailStatsTab } from '@/components/server-detail-tabs/server-detail-stats-tab'; // Import the new tab

interface RegisteredServer {
  id: string;
  name?: string;
  ip_address: string;
}

interface ServerDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: RegisteredServer;
  userRole: 'user' | 'admin' | 'super_admin' | null;
}

export function ServerDetailDialog({ open, onOpenChange, server, userRole }: ServerDetailDialogProps) {
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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="docker" className="flex items-center gap-2">
                <Dock className="h-4 w-4" /> Docker
              </TabsTrigger>
              <TabsTrigger value="resources" className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" /> Recursos
              </TabsTrigger>
              <TabsTrigger value="weblinks" className="flex items-center gap-2">
                <Link className="h-4 w-4" /> Web
              </TabsTrigger>
              <TabsTrigger value="stats" className="flex items-center gap-2">
                <BarChartIcon className="h-4 w-4" /> Estadísticas
              </TabsTrigger>
            </TabsList>
            <div className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-full w-full">
                <TabsContent value="docker" className="h-full">
                  <ServerDetailDockerTab server={server} userRole={userRole} />
                </TabsContent>
                <TabsContent value="resources" className="h-full">
                  <ServerDetailResourcesTab serverId={server.id} />
                </TabsContent>
                <TabsContent value="weblinks" className="h-full">
                  <ServerDetailWebLinksTab serverId={server.id} />
                </TabsContent>
                <TabsContent value="stats" className="h-full">
                  <ServerDetailStatsTab serverId={server.id} />
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