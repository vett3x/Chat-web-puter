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
import { Button } from '@/components/ui/button';
import { Server } from 'lucide-react';
import { AdminPanelTabs } from './admin-panel-tabs'; // Import the new tabs component

interface AdminPanelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAlerts: () => void;
  initialTab?: string; // NEW: Prop para la pestaña inicial
}

export function AdminPanelDialog({ open, onOpenChange, onOpenAlerts, initialTab }: AdminPanelDialogProps) {
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
        <div className="flex-1 py-4 overflow-hidden">
          <AdminPanelTabs onOpenAlerts={onOpenAlerts} initialTab={initialTab} /> {/* Pasar initialTab */}
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