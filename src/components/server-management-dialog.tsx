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
import { ServerManagementTabs } from './server-management-tabs'; // Import the new tabs component

interface ServerManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ServerManagementDialog({ open, onOpenChange }: ServerManagementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[95vw] p-6 h-[95vh] flex flex-col"> {/* Increased max-width to 95vw */}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-6 w-6" /> Gestión de Servidores
          </DialogTitle>
          <DialogDescription>
            Aquí puedes añadir y gestionar los servidores que utilizará DeepCoder para desplegar entornos de desarrollo.
            Recuerda que las credenciales SSH se enviarán a tu backend de orquestación para su gestión segura.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 py-4 overflow-hidden">
          <ServerManagementTabs />
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