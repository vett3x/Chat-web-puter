"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dock, PlusCircle, Loader2, RefreshCw, AlertCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '@/components/session-context-provider';
import { PERMISSION_KEYS } from '@/lib/constants';
import { DockerContainer } from '@/types/docker';
import { CreateContainerDialog } from './docker/CreateContainerDialog';
import { DockerContainerList } from './docker/DockerContainerList';

interface RegisteredServer {
  id: string;
  name?: string;
  ip_address: string;
}

interface ServerDetailDockerTabProps {
  server: RegisteredServer;
  userRole: 'user' | 'admin' | 'super_admin' | null;
}

export function ServerDetailDockerTab({ server, userRole }: ServerDetailDockerTabProps) {
  const { userPermissions } = useSession();
  const canManageDockerContainers = userPermissions[PERMISSION_KEYS.CAN_MANAGE_DOCKER_CONTAINERS];
  const canManageCloudflareTunnels = userPermissions[PERMISSION_KEYS.CAN_MANAGE_CLOUDFLARE_TUNNELS];

  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isCreateContainerDialogOpen, setIsCreateContainerDialogOpen] = useState(false);

  const fetchContainers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/servers/${server.id}/docker/containers`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: DockerContainer[] = await response.json();
      setContainers(data);
    } catch (err: any) {
      console.error('Error fetching Docker containers:', err);
      setError(err.message || 'Error al cargar los contenedores Docker.');
      toast.error(err.message || 'Error al cargar los contenedores Docker.');
    } finally {
      setIsLoading(false);
    }
  }, [server.id]);

  useEffect(() => {
    if (server.id) {
      fetchContainers();
    }
  }, [server.id, fetchContainers]);

  const handleContainerAction = async (containerId: string, action: 'start' | 'stop' | 'delete' | 'restart') => {
    setActionLoading(containerId);
    try {
      let response;
      if (action === 'delete') {
        response = await fetch(`/api/servers/${server.id}/docker/containers/${containerId}`, { method: 'DELETE' });
      } else {
        response = await fetch(`/api/servers/${server.id}/docker/containers/${containerId}/${action}`, { method: 'POST' });
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `HTTP error! status: ${response.status}`);
      
      toast.success(result.message || `Acción '${action}' realizada correctamente.`);
      await fetchContainers();
      
    } catch (err: any) {
      console.error(`Error performing ${action} on container ${containerId}:`, err);
      toast.error(err.message || `Error al realizar la acción '${action}'.`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleContainerCreated = () => {
    fetchContainers();
  };

  const errorContainers = containers.filter(c => {
    const isRunning = c.Status.includes('Up');
    const isGracefullyExited = c.Status.includes('Exited (0)') || c.Status.includes('Exited (137)');
    return !isRunning && !isGracefullyExited;
  });

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2"><Dock className="h-5 w-5" /> Contenedores Docker</CardTitle>
          <div className="flex items-center gap-2">
            {errorContainers.length > 0 && (
              <span className="text-sm font-medium text-destructive flex items-center gap-1" title={`${errorContainers.length} contenedor(es) con problemas`}>
                <AlertCircle className="h-4 w-4" /> {errorContainers.length} Errores
              </span>
            )}
            <Button size="sm" disabled={!canManageDockerContainers} onClick={() => setIsCreateContainerDialogOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Crear Contenedor
            </Button>
            <Button variant="ghost" size="icon" onClick={fetchContainers} disabled={isLoading || actionLoading !== null} title="Refrescar">
              {isLoading || actionLoading !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Cargando contenedores...</p></div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-destructive"><XCircle className="h-6 w-6 mr-2" /><p>{error}</p></div>
          ) : containers.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground"><p>No se encontraron contenedores Docker en este servidor.</p></div>
          ) : (
            <DockerContainerList
              containers={containers}
              server={server}
              isLoading={isLoading}
              actionLoading={actionLoading}
              onAction={handleContainerAction}
              onRefresh={fetchContainers}
              canManageDockerContainers={canManageDockerContainers}
              canManageCloudflareTunnels={canManageCloudflareTunnels}
            />
          )}
        </CardContent>
      </Card>
      <CreateContainerDialog
        open={isCreateContainerDialogOpen}
        onOpenChange={setIsCreateContainerDialogOpen}
        serverId={server.id}
        onContainerCreated={handleContainerCreated}
        canManageDockerContainers={canManageDockerContainers}
        canManageCloudflareTunnels={canManageCloudflareTunnels}
      />
    </>
  );
}