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
import { Users } from 'lucide-react';
import { UserManagementTabs } from './UserManagementTabs';
import { useSession } from '@/components/session-context-provider';
import { useIsMobile } from '@/hooks/use-mobile';

interface UserManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserManagementDialog({ open, onOpenChange }: UserManagementDialogProps) {
  const { isUserTemporarilyDisabled } = useSession();
  const isMobile = useIsMobile();

  const content = (
    <div className="flex-1 py-4 overflow-hidden">
      <UserManagementTabs isUserTemporarilyDisabled={isUserTemporarilyDisabled} />
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[95vh] flex flex-col">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              <Users className="h-6 w-6" /> Gestión de Usuarios
            </DrawerTitle>
            <DrawerDescription>
              Gestiona los usuarios de la aplicación, sus roles y permisos.
            </DrawerDescription>
          </DrawerHeader>
          {content}
          <DrawerFooter className="pt-2">
            <DrawerClose asChild>
              <Button variant="outline" disabled={isUserTemporarilyDisabled}>Cerrar</Button>
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
            <Users className="h-6 w-6" /> Gestión de Usuarios
          </DialogTitle>
          <DialogDescription>
            Gestiona los usuarios de la aplicación, sus roles y permisos.
          </DialogDescription>
        </DialogHeader>
        {content}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isUserTemporarilyDisabled}>Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}