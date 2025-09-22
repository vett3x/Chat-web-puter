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
import { Button } from '@/components/ui/button';
import { User, Server, Cloud, History, MessageSquare, HardDrive } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserServersTab } from './user-servers-tab';
import { UserCloudflareTab } from './user-cloudflare-tab'; // Import new tab
import { UserConversationsTab } from './user-conversations-tab'; // Import new tab
import { UserResourcesTab } from './user-resources-tab'; // Import new tab
import { UserActivityTab } from './user-activity-tab'; // Import new tab

interface UserDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
}

export function UserDetailDialog({ open, onOpenChange, user }: UserDetailDialogProps) {
  const [activeTab, setActiveTab] = useState('servers');

  const userName = user.first_name && user.last_name 
    ? `${user.first_name} ${user.last_name}` 
    : user.email;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[95vw] p-6 h-[95vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-6 w-6" /> Detalles del Usuario: {userName}
          </DialogTitle>
          <DialogDescription>
            Información detallada y gestión para el usuario {user.email}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 py-4 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="servers" className="flex items-center gap-2">
                <Server className="h-4 w-4" /> Servidores
              </TabsTrigger>
              <TabsTrigger value="cloudflare" className="flex items-center gap-2">
                <Cloud className="h-4 w-4" /> Cloudflare
              </TabsTrigger>
              <TabsTrigger value="conversations" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Conversaciones
              </TabsTrigger>
              <TabsTrigger value="resources" className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" /> Recursos
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex items-center gap-2">
                <History className="h-4 w-4" /> Actividad
              </TabsTrigger>
            </TabsList>
            <div className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-full w-full">
                <TabsContent value="servers" className="h-full">
                  <UserServersTab userId={user.id} />
                </TabsContent>
                <TabsContent value="cloudflare" className="h-full">
                  <UserCloudflareTab userId={user.id} />
                </TabsContent>
                <TabsContent value="conversations" className="h-full">
                  <UserConversationsTab userId={user.id} />
                </TabsContent>
                <TabsContent value="resources" className="h-full">
                  <UserResourcesTab userId={user.id} />
                </TabsContent>
                <TabsContent value="activity" className="h-full">
                  <UserActivityTab userId={user.id} />
                </TabsContent>
              </ScrollArea>
            </div>
          </Tabs>
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