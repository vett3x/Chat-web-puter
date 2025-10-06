"use client";

import React, { useState, useRef } from 'react';
import { Users, UserPlus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { UserListTab, UserListTabRef } from '@/components/user-management-tabs/user-list-tab';
import { AddUserForm } from '@/components/user-management-tabs/add-user-form';

interface UserManagementTabsProps {
  isUserTemporarilyDisabled: boolean;
}

export function UserManagementTabs({ isUserTemporarilyDisabled }: UserManagementTabsProps) {
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

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col flex-1 py-4 overflow-hidden">
      <TabsList className="grid w-full grid-cols-2">
        {tabs.map(tab => (
          <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2" disabled={isUserTemporarilyDisabled}>
            {tab.icon} {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="flex-1 overflow-hidden mt-4">
        <ScrollArea className="h-full w-full">
          <TabsContent value="user-list">
            <UserListTab ref={userListTabRef} isUserTemporarilyDisabled={isUserTemporarilyDisabled} />
          </TabsContent>
          <TabsContent value="add-user">
            <AddUserForm onUserAdded={handleUserAdded} isUserTemporarilyDisabled={isUserTemporarilyDisabled} />
          </TabsContent>
        </ScrollArea>
      </div>
    </Tabs>
  );
}