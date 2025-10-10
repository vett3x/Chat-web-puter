"use client";

import React, { useState, useRef } from 'react';
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
import { Users, UserPlus, Menu } from 'lucide-react';
import { useSession } from '@/components/session-context-provider';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from './ui/scroll-area';
import { UserListTab, UserListTabRef } from '@/components/user-management-tabs/user-list-tab';
import { AddUserForm } from '@/components/user-management-tabs/add-user-form';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserManagementTabs } from './user-management-tabs';

interface UserManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserManagementDialog({ open, onOpenChange }: UserManagementDialogProps) {
  const { isUserTemporarilyDisabled } = useSession();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('user-list');
  const userListTabRef = React.useRef<UserListTabRef>(null);

  const handleUserAdded = () => {
    userListTabRef.current?.fetchUsers();
    setActiveTab('user-list');
  };

  const tabs = [
    { value: 'user-list', label: 'Lista de Usuarios', icon: <Users className="h-4 w-4" /> },
    { value: 'add-user', label: 'Añadir Usuario', icon: <UserPlus className="h-4 w-4" /> },
  ];

  const tabContent = (
    <ScrollArea className="h-full w-full">
      {activeTab === 'user-list' && <UserListTab ref={userListTabRef} isUserTemporarilyDisabled={isUserTemporarilyDisabled} />}
      {activeTab === 'add-user' && <AddUserForm onUserAdded={handleUserAdded} isUserTemporarilyDisabled={isUserTemporarilyDisabled} />}
    </ScrollArea>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[95dvh] flex flex-col bg-[var(--sidebar-background)] backdrop-blur-[var(--chat-bubble-blur)] border-t-[var(--sidebar-border)]">
          <DrawerHeader className="flex flex-row items-center justify-between p-4 border-b border-b-[var(--sidebar-border)]">
            <DrawerTitle className="flex items-center gap-2 text-lg font-semibold">
              <Users className="h-5 w-5" /> Gestión de Usuarios
            </DrawerTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={isUserTemporarilyDisabled}><Menu className="h-5 w-5" /></Button>
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
          <DrawerFooter className="pt-2 border-t border-t-[var(--sidebar-border)]">
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
      <DialogContent className="w-full max-w-[95vw] p-4 h-[90vh] sm:max-w-4xl sm:p-6 sm:h-[95vh] flex flex-col bg-[var(--sidebar-background)] backdrop-blur-[var(--chat-bubble-blur)] border-[var(--sidebar-border)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-6 w-6" /> Gestión de Usuarios
          </DialogTitle>
          <DialogDescription>
            Gestiona los usuarios de la aplicación, sus roles y permisos.
          </DialogDescription>
        </DialogHeader>
        <UserManagementTabs isUserTemporarilyDisabled={isUserTemporarilyDisabled} />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" className="bg-transparent border border-[var(--chat-bubble-border-color)] hover:bg-white/10">Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}