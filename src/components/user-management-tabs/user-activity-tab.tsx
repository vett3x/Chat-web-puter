"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, History, RefreshCw, AlertCircle, Server } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ServerEvent {
  id: string;
  event_type: string;
  description: string;
  created_at: string;
  server_name: string;
}

interface UserActivityTabProps {
  userId: string;
}

export function UserActivityTab({ userId }: UserActivityTabProps) {
  const [events, setEvents] = useState<ServerEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserActivity = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/users/${userId}/activity-log`, { credentials: 'include' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: ServerEvent[] = await response.json();
      setEvents(data);
    } catch (err: any) {
      console.error(`Error fetching activity log for user ${userId}:`, err);
      setError(err.message || 'Error al cargar el historial de actividad del usuario.');
      toast.error(err.message || 'Error al cargar el historial de actividad del usuario.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchUserActivity();
    }
  }, [userId, fetchUserActivity]);

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'server_added': return 'Servidor Añadido';
      case 'server_deleted': return 'Servidor Eliminado';
      case 'server_add_failed': return 'Fallo al Añadir Servidor';
      case 'server_delete_failed': return 'Fallo al Eliminar Servidor';
      case 'container_created': return 'Contenedor Creado';
      case 'container_started': return 'Contenedor Iniciado';
      case 'container_stopped': return 'Contenedor Detenido';
      case 'container_deleted': return 'Contenedor Eliminado';
      case 'container_create_failed': return 'Fallo al Crear Contenedor';
      case 'container_start_failed': return 'Fallo al Iniciar Contenedor';
      case 'container_stop_failed': return 'Fallo al Detener Contenedor';
      case 'container_delete_failed': return 'Fallo al Eliminar Contenedor';
      case 'container_create_warning': return 'Advertencia al Crear Contenedor';
      case 'user_created': return 'Usuario Creado';
      case 'user_deleted': return 'Usuario Eliminado';
      case 'user_create_failed': return 'Fallo al Crear Usuario';
      case 'user_delete_failed': return 'Fallo al Eliminar Usuario';
      case 'tunnel_created': return 'Túnel Creado';
      case 'tunnel_deleted': return 'Túnel Eliminado';
      case 'tunnel_create_failed': return 'Fallo al Crear Túnel';
      case 'tunnel_delete_failed': return 'Fallo al Eliminar Túnel';
      default: return type;
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" /> Historial de Actividad
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={fetchUserActivity} disabled={isLoading} title="Refrescar">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden pt-0">
        {isLoading && events.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Cargando historial...</p>
          </div>
        ) : error && events.length === 0 ? (
          <div className="flex items-center justify-center h-full text-destructive">
            <AlertCircle className="h-6 w-6 mr-2" />
            <p>{error}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>No hay eventos registrados para este usuario.</p>
          </div>
        ) : (
          <ScrollArea className="h-full w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Fecha</TableHead>
                  <TableHead className="w-[150px]">Tipo de Evento</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="w-[150px]">Servidor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-xs">
                      {format(new Date(event.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
                    </TableCell>
                    <TableCell className="font-medium text-xs">{getEventTypeLabel(event.event_type)}</TableCell>
                    <TableCell className="text-sm">{event.description}</TableCell>
                    <TableCell className="text-xs flex items-center gap-1">
                      {event.server_name !== 'N/A' && <Server className="h-3 w-3 text-muted-foreground" />}
                      {event.server_name}
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