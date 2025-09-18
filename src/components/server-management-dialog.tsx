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
import { ServerManagementForm } from '@/components/server-management-form';
import { Server } from 'lucide-react';

interface ServerManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ServerManagementDialog({ open, onOpenChange }: ServerManagementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-6 w-6" /> Gestión de Servidores
          </DialogTitle>
          <DialogDescription>
            Aquí puedes añadir y gestionar los servidores que utilizará DeepCoder para desplegar entornos de desarrollo.
            Recuerda que las credenciales SSH se enviarán a tu backend de orquestación para su gestión segura.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <ServerManagementForm />
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