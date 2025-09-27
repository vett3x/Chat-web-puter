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
import { Users } from 'lucide-react';
import { UserManagementTabs } from './UserManagementTabs'; // Updated import path
import { useSession } from '@/components/session-context-provider'; // Import useSession

interface UserManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserManagementDialog({ open, onOpenChange }: UserManagementDialogProps) {
  const { isUserTemporarilyDisabled } = useSession(); // Get the disabled state

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[95vw] p-6 h-[95vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-6 w-6" /> Gestión de Usuarios
          </DialogTitle>
          <DialogDescription>
            Gestiona los usuarios de la aplicación, sus roles y permisos.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 py-4 overflow-hidden">
          <UserManagementTabs isUserTemporarilyDisabled={isUserTemporarilyDisabled} /> {/* Pass the prop */}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isUserTemporarilyDisabled}>Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}