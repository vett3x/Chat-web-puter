"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { History, Loader2, XCircle, Server } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale'; // Import Spanish locale

interface ServerEvent {
  id: string;
  event_type: string;
  description: string;
  created_at: string;
  server_name: string; // Name or IP of the server, or 'N/A'
}

export function UsageHistoryTab() {
  const [events, setEvents] = useState<ServerEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServerHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/server-history');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: ServerEvent[] = await response.json();
      setEvents(data);
    } catch (err: any) {
      console.error('Error fetching server history:', err);
      setError(err.message || 'Error al cargar el historial de uso.');
      toast.error(err.message || 'Error al cargar el historial de uso.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServerHistory();
  }, [fetchServerHistory]);

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
      default: return type;
    }
  };

  return (
    <Card className="bg-black/20 border-white/10">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" /> Historial de Uso
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading && events.length === 0 ? (
          <div className="flex items-center justify-center h-full py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Cargando historial...</p>
          </div>
        ) : error && events.length === 0 ? (
          <div className="flex items-center justify-center h-full py-8 text-destructive">
            <XCircle className="h-6 w-6 mr-2" />
            <p>{error}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="flex items-center justify-center h-full py-8 text-muted-foreground">
            <p>No hay eventos registrados aún.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
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
            </div>
            {/* Mobile Cards */}
            <div className="md:hidden space-y-4 pt-4">
              {events.map((event) => (
                <Card key={event.id}>
                  <CardContent className="p-4 space-y-2">
                    <h4 className="font-semibold">{getEventTypeLabel(event.event_type)}</h4>
                    <p className="text-sm text-muted-foreground">{event.description}</p>
                    <div className="flex justify-between items-center text-xs text-muted-foreground pt-2">
                      <span className="flex items-center gap-1">
                        {event.server_name !== 'N/A' && <Server className="h-3 w-3" />}
                        {event.server_name}
                      </span>
                      <span>{format(new Date(event.created_at), 'dd/MM/yy HH:mm', { locale: es })}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}