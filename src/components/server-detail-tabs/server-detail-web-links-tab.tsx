"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link, Globe, Loader2, RefreshCw, XCircle, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSession } from '@/components/session-context-provider'; // Import useSession
import { PERMISSION_KEYS } from '@/lib/constants'; // Import PERMISSION_KEYS

// New interface for Docker Tunnel data fetched for Web Links tab
interface ServerDockerTunnel {
  id: string;
  container_id: string;
  full_domain: string;
  container_port: number;
  status: 'pending' | 'provisioning' | 'active' | 'failed';
  domain_name: string; // From cloudflare_domains join
}

interface ServerDetailWebLinksTabProps {
  serverId: string;
}

export function ServerDetailWebLinksTab({ serverId }: ServerDetailWebLinksTabProps) {
  const { userPermissions } = useSession(); // Get user permissions
  const canManageCloudflareTunnels = userPermissions[PERMISSION_KEYS.CAN_MANAGE_CLOUDFLARE_TUNNELS];

  const [tunnels, setTunnels] = useState<ServerDockerTunnel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeletingTunnel, setIsDeletingTunnel] = useState<string | null>(null); // State for deletion loading

  const fetchTunnels = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/servers/${serverId}/docker/tunnels`, { credentials: 'include' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: ServerDockerTunnel[] = await response.json();
      setTunnels(data);
    } catch (err: any) {
      console.error('Error fetching Docker tunnels for web links:', err);
      setError(err.message || 'Error al cargar los enlaces web.');
      toast.error(err.message || 'Error al cargar los enlaces web.');
    } finally {
      setIsLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    if (serverId) {
      fetchTunnels();
    }
  }, [serverId, fetchTunnels]);

  const handleDeleteTunnel = async (tunnelRecordId: string, containerId: string) => {
    setIsDeletingTunnel(tunnelRecordId);
    try {
      const response = await fetch(`/api/servers/${serverId}/docker/containers/${containerId}/tunnel?tunnelRecordId=${tunnelRecordId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }
      toast.success(result.message || 'Túnel eliminado correctamente.');
      fetchTunnels(); // Refresh the list
    } catch (err: any) {
      console.error('Error deleting Cloudflare tunnel:', err);
      toast.error(err.message || 'Error al eliminar el túnel.');
    } finally {
      setIsDeletingTunnel(null);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <Link className="h-5 w-5" /> Enlaces Web
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={fetchTunnels} disabled={isLoading} title="Refrescar">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden pt-0">
        {isLoading && tunnels.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Cargando enlaces web...</p>
          </div>
        ) : error && tunnels.length === 0 ? (
          <div className="flex items-center justify-center h-full text-destructive">
            <XCircle className="h-6 w-6 mr-2" />
            <p>{error}</p>
          </div>
        ) : tunnels.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>No hay túneles de Cloudflare configurados para este servidor.</p>
          </div>
        ) : (
          <ScrollArea className="h-full w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dominio</TableHead>
                  <TableHead>Contenedor ID</TableHead>
                  <TableHead>Puerto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tunnels.map((tunnel) => (
                  <TableRow key={tunnel.id}>
                    <TableCell className="font-medium">
                      <a href={`https://${tunnel.full_domain}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
                        <Globe className="h-4 w-4" /> {tunnel.full_domain}
                      </a>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{tunnel.container_id.substring(0, 12)}</TableCell>
                    <TableCell>{tunnel.container_port}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "flex items-center gap-1",
                        tunnel.status === 'active' && "text-green-500",
                        tunnel.status === 'failed' && "text-destructive",
                        (tunnel.status === 'pending' || tunnel.status === 'provisioning') && "text-blue-500"
                      )}>
                        {tunnel.status === 'active' && <CheckCircle2 className="h-4 w-4" />}
                        {tunnel.status === 'failed' && <AlertCircle className="h-4 w-4" />}
                        {(tunnel.status === 'pending' || tunnel.status === 'provisioning') && <Loader2 className="h-4 w-4 animate-spin" />}
                        {tunnel.status === 'pending' && 'Pendiente'}
                        {tunnel.status === 'provisioning' && 'Aprovisionando'}
                        {tunnel.status === 'active' && 'Activo'}
                        {tunnel.status === 'failed' && 'Fallido'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="destructive" 
                            size="icon" 
                            className="h-8 w-8" 
                            disabled={!canManageCloudflareTunnels || isDeletingTunnel === tunnel.id} 
                            title={!canManageCloudflareTunnels ? "No tienes permiso para eliminar túneles" : "Eliminar túnel"}
                          >
                            {isDeletingTunnel === tunnel.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás seguro de eliminar este túnel?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción eliminará permanentemente el túnel "{tunnel.full_domain}" y su configuración asociada en Cloudflare y en el servidor remoto.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDeleteTunnel(tunnel.id, tunnel.container_id)} 
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}