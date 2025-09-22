"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShieldCheck, Save, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '@/components/session-context-provider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PERMISSION_KEYS } from '@/lib/constants'; // Importar PERMISSION_KEYS

interface UserPermissionsTabProps {
  userId: string;
  targetUserRole: 'user' | 'admin' | 'super_admin';
  currentUserRole: 'user' | 'admin' | 'super_admin' | null;
  onPermissionsUpdated: () => void; // Callback to refresh user list or details
}

interface PermissionState {
  [key: string]: boolean;
}

const permissionLabels: { [key: string]: string } = {
  [PERMISSION_KEYS.CAN_CREATE_SERVER]: 'Puede crear servidores',
  [PERMISSION_KEYS.CAN_MANAGE_DOCKER_CONTAINERS]: 'Puede gestionar contenedores Docker',
  [PERMISSION_KEYS.CAN_MANAGE_CLOUDFLARE_DOMAINS]: 'Puede gestionar dominios de Cloudflare',
  [PERMISSION_KEYS.CAN_MANAGE_CLOUDFLARE_TUNNELS]: 'Puede gestionar túneles de Cloudflare',
};

export function UserPermissionsTab({
  userId,
  targetUserRole,
  currentUserRole,
  onPermissionsUpdated,
}: UserPermissionsTabProps) {
  const { session } = useSession();
  const [permissions, setPermissions] = useState<PermissionState>({});
  const [initialPermissions, setInitialPermissions] = useState<PermissionState>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCurrentUserSuperAdmin = currentUserRole === 'super_admin';
  const isTargetUserSuperAdmin = targetUserRole === 'super_admin';
  const isChangingOwnPermissions = session?.user?.id === userId;
  const canEdit = isCurrentUserSuperAdmin && !isTargetUserSuperAdmin && !isChangingOwnPermissions;

  const fetchPermissions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/users/${userId}/permissions`, { credentials: 'include' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setPermissions(data.permissions || {});
      setInitialPermissions(data.permissions || {});
    } catch (err: any) {
      console.error(`Error fetching permissions for user ${userId}:`, err);
      setError(err.message || 'Error al cargar los permisos del usuario.');
      toast.error(err.message || 'Error al cargar los permisos del usuario.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchPermissions();
    }
  }, [userId, fetchPermissions]);

  const handlePermissionChange = (key: string, checked: boolean) => {
    setPermissions(prev => ({ ...prev, [key]: checked }));
  };

  const handleSavePermissions = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/users/${userId}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions }),
        credentials: 'include',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }
      toast.success(result.message || 'Permisos actualizados correctamente.');
      setInitialPermissions(permissions); // Update initial state
      onPermissionsUpdated();
    } catch (err: any) {
      console.error('Error saving permissions:', err);
      setError(err.message || 'Error al guardar los permisos.');
      toast.error(err.message || 'Error al guardar los permisos.');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = JSON.stringify(permissions) !== JSON.stringify(initialPermissions);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Cargando permisos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive">
        <AlertCircle className="h-6 w-6 mr-2" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> Permisos
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        {!isCurrentUserSuperAdmin ? (
          <p className="text-muted-foreground">Solo los Super Admins pueden ver y modificar los permisos de los usuarios.</p>
        ) : isTargetUserSuperAdmin ? (
          <p className="text-muted-foreground">No se pueden modificar los permisos de un Super Admin.</p>
        ) : isChangingOwnPermissions ? (
          <p className="text-muted-foreground">No puedes modificar tus propios permisos de Super Admin.</p>
        ) : (
          <div className="space-y-4">
            {Object.values(PERMISSION_KEYS).map((key) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={`permission-${key}`} className="text-base font-normal">
                  {permissionLabels[key] || key}
                </Label>
                <Switch
                  id={`permission-${key}`}
                  checked={permissions[key] || false}
                  onCheckedChange={(checked) => handlePermissionChange(key, checked)}
                  disabled={!canEdit || isSaving}
                />
              </div>
            ))}
            <Button
              onClick={handleSavePermissions}
              disabled={!canEdit || isSaving || !hasChanges}
              className="mt-6"
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Guardar Cambios
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}