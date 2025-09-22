"use client";

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, UserPlus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area'; // Usando alias para consistencia
import { UserListTab } from '@/components/user-management-tabs/user-list-tab'; // Ruta de importación corregida

export function UserManagementTabs() {
  const [activeTab, setActiveTab] = useState('user-list');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="user-list" className="flex items-center gap-2">
          <Users className="h-4 w-4" /> Lista de Usuarios
        </TabsTrigger>
        <TabsTrigger value="add-user" className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" /> Añadir Usuario
        </TabsTrigger>
      </TabsList>
      <div className="flex-1 overflow-hidden mt-4">
        <ScrollArea className="h-full w-full">
          <TabsContent value="user-list" className="h-full">
            <UserListTab />
          </TabsContent>
          <TabsContent value="add-user" className="h-full">
            {/* Placeholder for Add User form */}
            <div className="p-4 text-muted-foreground">
              Funcionalidad para añadir usuarios en desarrollo.
            </div>
          </TabsContent>
        </ScrollArea>
      </div>
    </Tabs>
  );
}