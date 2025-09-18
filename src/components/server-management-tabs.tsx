"use client";

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Server, Dock, History, Cloud } from 'lucide-react';
import { ServerListTab } from './server-tabs/server-list-tab'; // Removed .tsx
import { DockerContainersTab } from './server-tabs/docker-containers-tab'; // Removed .tsx
import { UsageHistoryTab } from './server-tabs/usage-history-tab'; // Removed .tsx
import { CloudflareTunnelTab } from './server-tabs/cloudflare-tunnel-tab'; // Removed .tsx
import { ScrollArea } from './ui/scroll-area';

export function ServerManagementTabs() {
  const [activeTab, setActiveTab] = useState('servers');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="servers" className="flex items-center gap-2">
          <Server className="h-4 w-4" /> Servidores
        </TabsTrigger>
        <TabsTrigger value="docker" className="flex items-center gap-2">
          <Dock className="h-4 w-4" /> Docker
        </TabsTrigger>
        <TabsTrigger value="history" className="flex items-center gap-2">
          <History className="h-4 w-4" /> Historial
        </TabsTrigger>
        <TabsTrigger value="cloudflare" className="flex items-center gap-2">
          <Cloud className="h-4 w-4" /> Cloudflare
        </TabsTrigger>
      </TabsList>
      <div className="flex-1 overflow-hidden mt-4">
        <ScrollArea className="h-full w-full">
          <TabsContent value="servers" className="h-full">
            <ServerListTab />
          </TabsContent>
          <TabsContent value="docker" className="h-full">
            <DockerContainersTab />
          </TabsContent>
          <TabsContent value="history" className="h-full">
            <UsageHistoryTab />
          </TabsContent>
          <TabsContent value="cloudflare" className="h-full">
            <CloudflareTunnelTab />
          </TabsContent>
        </ScrollArea>
      </div>
    </Tabs>
  );
}