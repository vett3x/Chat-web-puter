"use client";

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Server, Shield, LayoutDashboard, Database, HardDrive } from 'lucide-react'; // Import HardDrive
import { ScrollArea } from './ui/scroll-area';
import { SecurityTab } from './server-tabs/security-tab';
import { useSession } from '@/components/session-context-provider';
import { cn } from '@/lib/utils';
import { AdminDashboardTab } from './admin/admin-dashboard';
import { DatabaseConfigTab } from './admin/database-config-tab';
import { InfrastructureTab } from './server-tabs/infrastructure-tab';
import { S3StorageTab } from './server-tabs/s3-storage-tab';
import { S3BackupsTab } from './server-tabs/s3-backups-tab'; // New import

interface AdminPanelTabsProps {
  onOpenAlerts: () => void;
}

export function AdminPanelTabs({ onOpenAlerts }: AdminPanelTabsProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { userRole } = useSession();
  const isSuperAdmin = userRole === 'super_admin';

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
      <TabsList className={cn("grid w-full", isSuperAdmin ? "grid-cols-6" : "grid-cols-1")}>
        {isSuperAdmin && (
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" /> Panel
          </TabsTrigger>
        )}
        <TabsTrigger value="servers" className="flex items-center gap-2">
          <Server className="h-4 w-4" /> Infraestructura
        </TabsTrigger>
        {isSuperAdmin && (
          <TabsTrigger value="database" className="flex items-center gap-2">
            <Database className="h-4 w-4" /> Base de Datos
          </TabsTrigger>
        )}
        {isSuperAdmin && (
          <TabsTrigger value="s3-storage" className="flex items-center gap-2">
            <Database className="h-4 w-4" /> Almacenamiento S3
          </TabsTrigger>
        )}
        {isSuperAdmin && (
          <TabsTrigger value="s3-backups" className="flex items-center gap-2">
            <HardDrive className="h-4 w-4" /> Backups S3
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
          {isSuperAdmin && (
            <TabsContent value="database" className="h-full">
              <DatabaseConfigTab />
            </TabsContent>
          )}
          {isSuperAdmin && (
            <TabsContent value="s3-storage" className="h-full">
              <S3StorageTab />
            </TabsContent>
          )}
          {isSuperAdmin && (
            <TabsContent value="s3-backups" className="h-full">
              <S3BackupsTab />
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