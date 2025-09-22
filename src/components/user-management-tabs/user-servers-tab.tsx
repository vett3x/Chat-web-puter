"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Server, RefreshCw, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UserServer {
  id: string;
  name: string | null;
  ip_address: string;
  ssh_port: number;
  status: 'pending' | 'provisioning' | 'ready' | 'failed';
  created_at: string;
}

interface UserServersTabProps {
  userId: string;
}

export function UserServersTab({ userId }: UserServersTabProps) {
  const [servers, setServers] = useState<UserServer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserServers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/users/${userId}/servers`, { credentials: 'include' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: UserServer[] = await response.json();
      setServers(data);
    } catch (err: any) {
      console.error(`Error fetching servers for user ${userId}:`, err);
      setError(err.message || 'Error al cargar los servidores del usuario.');
      toast.error(err.message || 'Error al cargar los servidores del usuario.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchUserServers();
    }
  }, [userId, fetchUserServers]);

  const getStatusIndicator = (status: UserServer['status']) => {
    switch (status) {
      case 'pending':
      case 'provisioning':
        return <span title="Aprovisionando..."><Loader2 className="h-4 w-4 animate-spin text-blue-500" /></span>;
      case 'ready':
        return <span title="Listo"><CheckCircle2 className="h-4 w-4 text-green-500" /></span>;
      case 'failed':
        return <span title="Falló"><XCircle className="h-4 w-4 text-destructive" /></span>;
      default:
        return null;
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" /> Servidores Asignados
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={fetchUserServers} disabled={isLoading} title="Refrescar">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden pt-0">
        {isLoading && servers.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Cargando servidores...</p>
          </div>
        ) : error && servers.length === 0 ? (
          <div className="flex items-center justify-center h-full text-destructive">
            <AlertCircle className="h-6 w-6 mr-2" />
            <p>{error}</p>
          </div>
        ) : servers.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>Este usuario no tiene servidores asignados.</p>
          </div>
        ) : (
          <ScrollArea className="h-full w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Puerto SSH</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servers.map((server) => (
                  <TableRow key={server.id}>
                    <TableCell className="font-medium">{server.name || 'Sin nombre'}</TableCell>
                    <TableCell>{server.ip_address}</TableCell>
                    <TableCell>{server.ssh_port}</TableCell>
                    <TableCell>
                      <span className={cn("flex items-center gap-1",
                        server.status === 'ready' && "text-green-500",
                        server.status === 'failed' && "text-destructive",
                        (server.status === 'pending' || server.status === 'provisioning') && "text-blue-500"
                      )}>
                        {getStatusIndicator(server.status)}
                        {server.status.charAt(0).toUpperCase() + server.status.slice(1)}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(server.created_at).toLocaleDateString()}</TableCell>
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