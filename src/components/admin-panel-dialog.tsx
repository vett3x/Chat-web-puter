"use client";

import React from 'react';
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
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Server } from 'lucide-react';
import { AdminPanelTabs } from './admin-panel-tabs';
import { useIsMobile } from '@/hooks/use-mobile';

interface AdminPanelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAlerts: () => void;
  initialTab?: string;
}

export function AdminPanelDialog({ open, onOpenChange, onOpenAlerts, initialTab }: AdminPanelDialogProps) {
  const isMobile = useIsMobile();

  const content = (
    <div className="flex-1 py-4 overflow-hidden">
      <AdminPanelTabs onOpenAlerts={onOpenAlerts} initialTab={initialTab} />
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[95vh] flex flex-col">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              <Server className="h-6 w-6" /> Panel de Administración
            </DrawerTitle>
            <DrawerDescription>
              Gestiona servidores, contenedores, seguridad y visualiza el estado general del sistema.
            </DrawerDescription>
          </DrawerHeader>
          {content}
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
        {content}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}