"use client";

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Server, Dock, History, Cloud } from 'lucide-react'; // Changed Docker to Dock
import { ServerListTab } from './server-tabs/server-list-tab.tsx'; // Added .tsx
import { DockerContainersTab } from './server-tabs/docker-containers-tab.tsx'; // Added .tsx
import { UsageHistoryTab } from './server-tabs/usage-history-tab.tsx'; // Added .tsx
import { CloudflareTunnelTab } from './server-tabs/cloudflare-tunnel-tab.tsx'; // Added .tsx
import { ScrollArea } from './ui/scroll-area'; // Import ScrollArea

export function ServerManagementTabs() {
  const [activeTab, setActiveTab] = useState('servers');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="servers" className="flex items-center gap-2">
          <Server className="h-4 w-4" /> Servidores
        </TabsTrigger>
        <TabsTrigger value="docker" className="flex items-center gap-2">
          <Dock className="h-4 w-4" /> Docker {/* Changed Docker to Dock */}
        </TabsTrigger>
        <TabsTrigger value="history" className="flex items-center gap-2">
          <History className="h-4 w-4" /> Historial
        </TabsTrigger>
        <TabsTrigger value="cloudflare" className="flex items-center gap-2">
          <Cloud className="h-4 w-4" /> Cloudflare
        </TabsTrigger>
      </TabsList>
      <div className="flex-1 overflow-hidden mt-4"> {/* Added flex-1 and overflow-hidden */}
        <ScrollArea className="h-full w-full"> {/* Wrap TabsContent in ScrollArea */}
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