"use client";

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, UserPlus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserListTab, UserListTabRef } from '@/components/user-management-tabs/user-list-tab';
import { AddUserForm } from '@/components/user-management-tabs/add-user-form';

interface UserManagementTabsProps {
  isUserTemporarilyDisabled: boolean; // Ensure this prop is declared
}

export function UserManagementTabs({ isUserTemporarilyDisabled }: UserManagementTabsProps) {
  const [activeTab, setActiveTab] = useState('user-list');
  const userListTabRef = React.useRef<UserListTabRef>(null);

  const handleUserAdded = () => {
    if (activeTab === 'user-list' && userListTabRef.current && userListTabRef.current.fetchUsers) {
      userListTabRef.current.fetchUsers();
    }
    setActiveTab('user-list');
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="user-list" className="flex items-center gap-2" disabled={isUserTemporarilyDisabled}>
          <Users className="h-4 w-4" /> Lista de Usuarios
        </TabsTrigger>
        <TabsTrigger value="add-user" className="flex items-center gap-2" disabled={isUserTemporarilyDisabled}>
          <UserPlus className="h-4 w-4" /> Añadir Usuario
        </TabsTrigger>
      </TabsList>
      <div className="flex-1 overflow-hidden mt-4">
        <ScrollArea className="h-full w-full">
          <TabsContent value="user-list" className="h-full">
            <UserListTab ref={userListTabRef} isUserTemporarilyDisabled={isUserTemporarilyDisabled} /> {/* Pass prop */}
          </TabsContent>
          <TabsContent value="add-user" className="h-full">
            <AddUserForm onUserAdded={handleUserAdded} isUserTemporarilyDisabled={isUserTemporarilyDisabled} /> {/* Pass prop */}
          </TabsContent>
        </ScrollArea>
      </div>
    </Tabs>
  );
}