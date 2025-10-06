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
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Server, Shield, LayoutDashboard, LifeBuoy, Menu } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSession } from '@/components/session-context-provider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { AdminDashboardTab } from './admin/admin-dashboard';
import { InfrastructureTab } from './server-tabs/infrastructure-tab';
import { SupportTicketsTab } from './server-tabs/support-tickets-tab';
import { SecurityTab } from './server-tabs/security-tab';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AdminPanelTabs } from './admin-panel-tabs';

interface AdminPanelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAlerts: () => void;
  initialTab?: string;
}

export function AdminPanelDialog({ open, onOpenChange, onOpenAlerts, initialTab }: AdminPanelDialogProps) {
  const isMobile = useIsMobile();
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

  const tabContent = (
    <ScrollArea className="h-full w-full">
      {activeTab === 'dashboard' && isSuperAdmin && <AdminDashboardTab onOpenAlerts={onOpenAlerts} />}
      {activeTab === 'servers' && <InfrastructureTab />}
      {activeTab === 'support' && isAdmin && <SupportTicketsTab />}
      {activeTab === 'security' && isSuperAdmin && <SecurityTab />}
    </ScrollArea>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[95vh] flex flex-col">
          <DrawerHeader className="flex flex-row items-center justify-between p-4 border-b">
            <DrawerTitle className="flex items-center gap-2 text-lg font-semibold">
              <Server className="h-5 w-5" /> Panel de Admin
            </DrawerTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {tabs.map(tab => (
                  <DropdownMenuItem key={tab.value} onClick={() => setActiveTab(tab.value)} className="flex items-center gap-2">
                    {tab.icon} <span>{tab.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </DrawerHeader>
          <div className="flex-1 overflow-hidden p-2">
            {tabContent}
          </div>
          <DrawerFooter className="pt-2">
            <DrawerClose asChild>
              <Button variant="outline">Cerrar</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[95vw] p-4 h-[90vh] sm:max-w-4xl sm:p-6 sm:h-[95vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-6 w-6" /> Panel de Administración
          </DialogTitle>
          <DialogDescription>
            Gestiona servidores, contenedores, seguridad y visualiza el estado general del sistema.
          </DialogDescription>
        </DialogHeader>
        <AdminPanelTabs onOpenAlerts={onOpenAlerts} initialTab={initialTab} />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}