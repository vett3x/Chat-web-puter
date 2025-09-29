"use client";

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Server, Dock, History, Cloud, Shield, LayoutDashboard } from 'lucide-react';
import { ServerListTab } from './server-tabs/server-list-tab';
import { UsageHistoryTab } from './server-tabs/usage-history-tab';
import { CloudflareTunnelTab } from './server-tabs/cloudflare-tunnel-tab';
import { ScrollArea } from './ui/scroll-area';
import { AllDockerContainersTab } from './server-tabs/all-docker-containers-tab';
import { SecurityTab } from './server-tabs/security-tab';
import { useSession } from '@/components/session-context-provider';
import { cn } from '@/lib/utils';
import { AdminDashboardTab } from './admin/admin-dashboard'; // Import the new dashboard tab

export function AdminPanelTabs() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { userRole } = useSession();
  const isSuperAdmin = userRole === 'super_admin';

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
      <TabsList className={cn("grid w-full", isSuperAdmin ? "grid-cols-6" : "grid-cols-4")}>
        {isSuperAdmin && (
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" /> Panel
          </TabsTrigger>
        )}
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
        {isSuperAdmin && (
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" /> Seguridad
          </TabsTrigger>
        )}
      </TabsList>
      <div className="flex-1 overflow-hidden mt-4">
        <ScrollArea className="h-full w-full">
          {isSuperAdmin && (
            <TabsContent value="dashboard" className="h-full">
              <AdminDashboardTab />
            </TabsContent>
          )}
          <TabsContent value="servers" className="h-full">
            <ServerListTab />
          </TabsContent>
          <TabsContent value="docker" className="h-full">
            <AllDockerContainersTab />
          </TabsContent>
          <TabsContent value="history" className="h-full">
            <UsageHistoryTab />
          </TabsContent>
          <TabsContent value="cloudflare" className="h-full">
            <CloudflareTunnelTab />
          </TabsContent>
          {isSuperAdmin && (
            <TabsContent value="security" className="h-full">
              <SecurityTab />
            </TabsContent>
          )}
        </ScrollArea>
      </div>
    </Tabs>
  );
}