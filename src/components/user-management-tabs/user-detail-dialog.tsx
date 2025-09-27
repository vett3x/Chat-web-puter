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
import { User, Server, Cloud, History, MessageSquare, HardDrive, Save, Loader2, ShieldCheck, KeyRound, Shield, LogOut, Clock } from 'lucide-react'; // Import Clock icon
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserServersTab } from './user-servers-tab';
import { UserCloudflareTab } from './user-cloudflare-tab';
import { UserConversationsTab } from './user-conversations-tab';
import { UserResourcesTab } from './user-resources-tab';
import { UserActivityTab } from './user-activity-tab';
import { UserPermissionsTab } from './user-permissions-tab';
import { UserAccountTab } from './user-account-tab';
import { UserModerationHistoryTab } from './user-moderation-history-tab'; // Import the new tab
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useSession } from '@/components/session-context-provider';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, addMinutes, intervalToDuration, formatDuration } from 'date-fns'; // Import addMinutes, intervalToDuration, formatDuration
import { es } from 'date-fns/locale';
import { Input } from '@/components/ui/input'; // Import Input for extend kick

type UserRole = 'user' | 'admin' | 'super_admin';
type UserStatus = 'active' | 'banned' | 'kicked';

interface UserDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    role: UserRole;
    status: UserStatus;
    kicked_at: string | null;
  };
  currentUserRole: UserRole | null;
  onRoleUpdated: () => void;
}

export function UserDetailDialog({ open, onOpenChange, user, currentUserRole, onRoleUpdated }: UserDetailDialogProps) {
  const { session } = useSession();
  const [activeTab, setActiveTab] = useState('servers');
  const [selectedRole, setSelectedRole] = useState<UserRole>(user.role);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [extendMinutes, setExtendMinutes] = useState<number>(15); // State for extending kick
  const [isExtendingKick, setIsExtendingKick] = useState(false); // State for loading during kick extension
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null); // NEW: State for remaining kick time

  useEffect(() => {
    console.log("[UserDetailDialog] User prop:", user); // Debug log
    setSelectedRole(user.role);
  }, [user.role, user]); // Added user to dependency array

  // NEW: Effect to update time remaining
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (user.status === 'kicked' && user.kicked_at) {
      const kickTime = new Date(user.kicked_at);
      const unkickTime = addMinutes(kickTime, 15); // Assuming 15 minutes default kick duration

      const updateRemainingTime = () => {
        const now = new Date();
        if (now < unkickTime) {
          const duration = intervalToDuration({ start: now, end: unkickTime });
          const formattedDuration = formatDuration(duration, { locale: es, zero: true, delimiter: ', ' });
          setTimeRemaining(formattedDuration);
        } else {
          setTimeRemaining(null);
          if (interval) clearInterval(interval);
          onRoleUpdated(); // Refresh user list to reflect unkick
        }
      };

      updateRemainingTime();
      interval = setInterval(updateRemainingTime, 1000);
    } else {
      setTimeRemaining(null);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [user.status, user.kicked_at, onRoleUpdated]);

  const userName = user.first_name && user.last_name 
    ? `${user.first_name} ${user.last_name}` 
    : user.email;

  const isCurrentUserSuperAdmin = currentUserRole === 'super_admin';
  const isTargetUserSuperAdmin = user.role === 'super_admin';
  const isChangingOwnRole = user.id === session?.user?.id;

  const handleRoleChange = async () => {
    if (!isCurrentUserSuperAdmin || isChangingOwnRole || selectedRole === user.role) {
      return;
    }

    setIsUpdatingRole(true);
    try {
      const response = await fetch(`/api/users/${user.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selectedRole }),
        credentials: 'include',
      });

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
      onRoleUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating user role:', error);
      toast.error(`Error al actualizar el rol: ${error.message}`);
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleExtendKick = async () => {
    if (!isCurrentUserSuperAdmin || user.status !== 'kicked' || !user.kicked_at || extendMinutes <= 0) {
      toast.error('Acción no válida para extender la expulsión.');
      return;
    }

    setIsExtendingKick(true);
    try {
      const response = await fetch(`/api/users/${user.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extend_kick', extend_minutes: extendMinutes, reason: `Expulsión extendida por ${extendMinutes} minutos.` }),
        credentials: 'include',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      onRoleUpdated(); // Refresh user data to show new kicked_at
      // No need to close dialog, user might want to extend again
    } catch (err: any) {
      toast.error(`Error al extender la expulsión: ${err.message}`);
    } finally {
      setIsExtendingKick(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[95vw] p-6 h-[95vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-6 w-6" /> Detalles del Usuario: {userName}
            {user.status === 'banned' && <Badge variant="destructive" className="ml-2">BANEADO</Badge>}
            {user.status === 'kicked' && <Badge variant="warning" className="ml-2">EXPULSADO</Badge>}
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

          {user.status === 'kicked' && user.kicked_at && (
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-sm text-yellow-200 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <LogOut className="h-5 w-5" />
                <span>Este usuario fue expulsado el {format(new Date(user.kicked_at), 'dd/MM/yyyy HH:mm', { locale: es })}.</span>
                <span className="font-semibold">Tiempo restante: {timeRemaining || 'Calculando...'}</span> {/* Always show, for debugging */}
              </div>
              {isCurrentUserSuperAdmin && (
                <div className="flex items-center gap-2 mt-2">
                  <Label htmlFor="extend-kick-minutes" className="text-base flex items-center gap-1">
                    <Clock className="h-4 w-4" /> Extender por:
                  </Label>
                  <Input
                    id="extend-kick-minutes"
                    type="number"
                    min="1"
                    value={extendMinutes}
                    onChange={(e) => setExtendMinutes(parseInt(e.target.value) || 0)}
                    className="w-24 bg-yellow-900/20 border-yellow-700/50 text-yellow-100"
                    disabled={isExtendingKick}
                  />
                  <span className="text-xs">minutos</span>
                  <Button
                    onClick={handleExtendKick}
                    disabled={isExtendingKick || extendMinutes <= 0}
                    size="sm"
                    className="bg-yellow-600 hover:bg-yellow-700 text-white"
                  >
                    {isExtendingKick ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}
                    Extender
                  </Button>
                </div>
              )}
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-8">
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
              <TabsTrigger value="permissions" className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Permisos
              </TabsTrigger>
              <TabsTrigger value="account" className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" /> Cuenta
              </TabsTrigger>
              <TabsTrigger value="moderation" className="flex items-center gap-2">
                <Shield className="h-4 w-4" /> Moderación
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
                <TabsContent value="permissions" className="h-full">
                  <UserPermissionsTab
                    userId={user.id}
                    targetUserRole={user.role}
                    currentUserRole={currentUserRole}
                    onPermissionsUpdated={onRoleUpdated}
                  />
                </TabsContent>
                <TabsContent value="account" className="h-full">
                  <UserAccountTab
                    userId={user.id}
                    userEmail={user.email}
                    currentUserRole={currentUserRole}
                    targetUserRole={user.role}
                    onAccountUpdated={onRoleUpdated}
                  />
                </TabsContent>
                <TabsContent value="moderation" className="h-full">
                  <UserModerationHistoryTab userId={user.id} currentUserRole={currentUserRole} />
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