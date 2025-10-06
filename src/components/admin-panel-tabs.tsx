"use client";

import React, { useState } from 'react';
import { Server, Shield, LayoutDashboard, LifeBuoy } from 'lucide-react';
import { useSession } from '@/components/session-context-provider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { AdminDashboardTab } from './admin/admin-dashboard';
import { InfrastructureTab } from './server-tabs/infrastructure-tab';
import { SupportTicketsTab } from './server-tabs/support-tickets-tab';
import { SecurityTab } from './server-tabs/security-tab';

interface AdminPanelTabsProps {
  onOpenAlerts: () => void;
  initialTab?: string;
}

export function AdminPanelTabs({ onOpenAlerts, initialTab }: AdminPanelTabsProps) {
  const { userRole } = useSession();
  const isSuperAdmin = userRole === 'super_admin';
  const isAdmin = userRole === 'admin' || isSuperAdmin;
  const [activeTab, setActiveTab] = useState(initialTab || (isSuperAdmin ? 'dashboard' : 'servers'));

  const tabs = [
    isSuperAdmin && { value: 'dashboard', label: 'Panel', icon: <LayoutDashboard className="h-4 w-4" /> },
    { value: 'servers', label: 'Infraestructura', icon: <Server className="h-4 w-4" /> },
    isAdmin && { value: 'support', label: 'Soporte', icon: <LifeBuoy className="h-4 w-4" /> },
    isSuperAdmin && { value: 'security', label: 'Seguridad', icon: <Shield className="h-4 w-4" /> },
  ].filter(Boolean) as { value: string; label: string; icon: React.ReactNode }[];

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col flex-1 py-4 overflow-hidden">
      <TabsList className="h-auto flex-col sm:h-10 sm:flex-row">
        {tabs.map(tab => (
          <TabsTrigger key={tab.value} value={tab.value} className="w-full justify-start sm:w-auto sm:justify-center flex items-center gap-2">
            {tab.icon} {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="flex-1 overflow-hidden mt-4">
        <ScrollArea className="h-full w-full">
          <TabsContent value="dashboard" className="h-full">
            {isSuperAdmin && <AdminDashboardTab onOpenAlerts={onOpenAlerts} />}
          </TabsContent>
          <TabsContent value="servers" className="h-full">
            <InfrastructureTab />
          </TabsContent>
          <TabsContent value="support" className="h-full">
            {isAdmin && <SupportTicketsTab />}
          </TabsContent>
          <TabsContent value="security" className="h-full">
            {isSuperAdmin && <SecurityTab />}
          </TabsContent>
        </ScrollArea>
      </div>
    </Tabs>
  );
}