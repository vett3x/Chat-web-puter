"use client";

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Server, Shield, LayoutDashboard, LifeBuoy } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { SecurityTab } from './server-tabs/security-tab';
import { useSession } from '@/components/session-context-provider';
import { cn } from '@/lib/utils';
import { AdminDashboardTab } from './admin/admin-dashboard';
import { InfrastructureTab } from './server-tabs/infrastructure-tab';
import { SupportTicketsTab } from './server-tabs/support-tickets-tab';

interface AdminPanelTabsProps {
  onOpenAlerts: () => void;
  initialTab?: string; // NEW: Prop para la pestaña inicial
}

export function AdminPanelTabs({ onOpenAlerts, initialTab }: AdminPanelTabsProps) {
  const [activeTab, setActiveTab] = useState(initialTab || 'dashboard'); // Usar initialTab como valor por defecto
  const { userRole } = useSession();
  const isSuperAdmin = userRole === 'super_admin';
  const isAdmin = userRole === 'admin' || isSuperAdmin;

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
      <TabsList className={cn("grid w-full", isSuperAdmin ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2")}>
        {isSuperAdmin && (
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" /> Panel
          </TabsTrigger>
        )}
        <TabsTrigger value="servers" className="flex items-center gap-2">
          <Server className="h-4 w-4" /> Infraestructura
        </TabsTrigger>
        {isAdmin && (
          <TabsTrigger value="support" className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4" /> Soporte
          </TabsTrigger>
        )}
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
              <AdminDashboardTab onOpenAlerts={onOpenAlerts} />
            </TabsContent>
          )}
          <TabsContent value="servers" className="h-full">
            <InfrastructureTab />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="support" className="h-full">
              <SupportTicketsTab />
            </TabsContent>
          )}
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