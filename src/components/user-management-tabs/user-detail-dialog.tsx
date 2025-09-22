"use client";

import React, { useState, useEffect } from 'react';
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
import { User, Server, Cloud, History, MessageSquare, HardDrive, Save, Loader2, ShieldCheck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserServersTab } from './user-servers-tab';
import { UserCloudflareTab } from './user-cloudflare-tab';
import { UserConversationsTab } from './user-conversations-tab';
import { UserResourcesTab } from './user-resources-tab';
import { UserActivityTab } from './user-activity-tab';
import { UserPermissionsTab } from './user-permissions-tab'; // Import the new tab
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useSession } from '@/components/session-context-provider'; // Import useSession

type UserRole = 'user' | 'admin' | 'super_admin';

interface UserDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    role: UserRole; // Added role to user prop
  };
  currentUserRole: UserRole | null; // Role of the currently logged-in user
  onRoleUpdated: () => void; // New prop: Callback to refresh user list
}

export function UserDetailDialog({ open, onOpenChange, user, currentUserRole, onRoleUpdated }: UserDetailDialogProps) {
  const { session } = useSession(); // Use useSession hook
  const [activeTab, setActiveTab] = useState('servers');
  const [selectedRole, setSelectedRole] = useState<UserRole>(user.role);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  useEffect(() => {
    setSelectedRole(user.role); // Reset selected role when user prop changes
  }, [user.role]);

  const userName = user.first_name && user.last_name 
    ? `${user.first_name} ${user.last_name}` 
    : user.email;

  const isCurrentUserSuperAdmin = currentUserRole === 'super_admin';
  const isTargetUserSuperAdmin = user.role === 'super_admin';
  const isChangingOwnRole = user.id === session?.user?.id;

  const handleRoleChange = async () => {
    if (!isCurrentUserSuperAdmin || isChangingOwnRole || selectedRole === user.role) {
      return; // Prevent unauthorized changes, changing own role, or no change
    }

    setIsUpdatingRole(true);
    try {
      const response = await fetch(`/api/users/${user.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selectedRole }),
        credentials: 'include',
      });

      // Leer la respuesta como texto primero para depuración
      const responseText = await response.text();
      console.log('Raw API response for role update:', responseText);

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (jsonError: any) {
        console.error('Error parsing JSON response for role update:', jsonError);
        throw new Error(`Respuesta inesperada del servidor: ${responseText.substring(0, 100)}... (Error de JSON: ${jsonError.message})`);
      }

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }

      toast.success(result.message || `Rol de usuario actualizado a '${selectedRole}'.`);
      onRoleUpdated(); // Notify parent to refresh user list
      onOpenChange(false); // Close dialog after successful update
    } catch (error: any) {
      console.error('Error updating user role:', error);
      toast.error(`Error al actualizar el rol: ${error.message}`);
    } finally {
      setIsUpdatingRole(false);
    }
  };

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
          <div className="mb-4 flex items-center gap-4">
            <Label htmlFor="user-role" className="text-base">Rol:</Label>
            <Select
              value={selectedRole}
              onValueChange={(value: UserRole) => setSelectedRole(value)}
              disabled={!isCurrentUserSuperAdmin || isChangingOwnRole || isUpdatingRole || isTargetUserSuperAdmin}
            >
              <SelectTrigger id="user-role" className="w-[180px]">
                <SelectValue placeholder="Seleccionar rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Usuario</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin" disabled={true}>Super Admin</SelectItem>
              </SelectContent>
            </Select>
            {isCurrentUserSuperAdmin && !isChangingOwnRole && !isTargetUserSuperAdmin && selectedRole !== user.role && (
              <Button onClick={handleRoleChange} disabled={isUpdatingRole}>
                {isUpdatingRole ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar Rol
              </Button>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-6"> {/* Increased grid-cols to 6 */}
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
              <TabsTrigger value="permissions" className="flex items-center gap-2"> {/* New tab */}
                <ShieldCheck className="h-4 w-4" /> Permisos
              </TabsTrigger>
            </TabsList>
            <div className="flex-1 py-4 overflow-hidden">
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
                <TabsContent value="permissions" className="h-full"> {/* New tab content */}
                  <UserPermissionsTab
                    userId={user.id}
                    targetUserRole={user.role}
                    currentUserRole={currentUserRole}
                    onPermissionsUpdated={onRoleUpdated} // Use the same callback to refresh parent data
                  />
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