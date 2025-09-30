"use client";

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Server, Dock, History, Cloud } from 'lucide-react';
import { ServerListTab } from './server-tabs/server-list-tab';
import { AllDockerContainersTab } from './server-tabs/all-docker-containers-tab';
import { UsageHistoryTab } from './server-tabs/usage-history-tab';
import { CloudflareTunnelTab } from './server-tabs/cloudflare-tunnel-tab';

export function ServerManagementTabs() {
  const [activeTab, setActiveTab] = useState('server-list');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="server-list" className="flex items-center gap-2">
          <Server className="h-4 w-4" /> Lista de Servidores
        </TabsTrigger>
        <TabsTrigger value="docker" className="flex items-center gap-2">
          <Dock className="h-4 w-4" /> Contenedores Docker
        </TabsTrigger>
        <TabsTrigger value="cloudflare" className="flex items-center gap-2">
          <Cloud className="h-4 w-4" /> Túneles Cloudflare
        </TabsTrigger>
        <TabsTrigger value="history" className="flex items-center gap-2">
          <History className="h-4 w-4" /> Historial de Uso
        </TabsTrigger>
      </TabsList>
      <div className="mt-4">
        <TabsContent value="server-list">
          <ServerListTab />
        </TabsContent>
        <TabsContent value="docker">
          <AllDockerContainersTab />
        </TabsContent>
        <TabsContent value="cloudflare">
          <CloudflareTunnelTab />
        </TabsContent>
        <TabsContent value="history">
          <UsageHistoryTab />
        </TabsContent>
      </div>
    </Tabs>
  );
}