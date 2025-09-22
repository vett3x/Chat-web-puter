"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, XCircle, History, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DockerContainer } from '@/types/docker';
import { cn } from '@/lib/utils';

interface ServerEvent {
  id: string;
  event_type: string;
  description: string;
  created_at: string;
}

interface ContainerHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: { id: string };
  container: DockerContainer;
}

export function ContainerHistoryDialog({ open, onOpenChange, server, container }: ContainerHistoryDialogProps) {
  const [events, setEvents] = useState<ServerEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/servers/${server.id}/docker/containers/${container.ID}/history`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: ServerEvent[] = await response.json();
      setEvents(data);
    } catch (err: any)      {
      console.error('Error fetching container history:', err);
      setError(err.message || 'Error al cargar el historial del contenedor.');
      toast.error(err.message || 'Error al cargar el historial del contenedor.');
    } finally {
      setIsLoading(false);
    }
  }, [server.id, container.ID]);

  useEffect(() => {
    if (open) {
      fetchHistory();
    }
  }, [open, fetchHistory]);

  const getEventIcon = (type: string) => {
    if (type.includes('failed')) {
      return <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />;
    }
    if (type.includes('warning')) {
      return <AlertCircle className="h-5 w-5 text-warning flex-shrink-0" />;
    }
    if (type.includes('deleted') || type.includes('stopped')) {
      return <Info className="h-5 w-5 text-muted-foreground flex-shrink-0" />;
    }
    return <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[70vw] w-[70vw] h-[80vh] flex flex-col p-4">
        <DialogHeader className="px-2 pt-2">
          <DialogTitle className="flex items-center gap-2">
            <History className="h-6 w-6" /> Historial del Contenedor: {container.Names}
          </DialogTitle>
          <DialogDescription>
            Registro de eventos importantes para el contenedor {container.ID.substring(0, 12)}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden py-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Cargando historial...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-destructive">
              <XCircle className="h-6 w-6 mr-2" />
              <p>{error}</p>
            </div>
          ) : events.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>No hay eventos registrados para este contenedor.</p>
            </div>
          ) : (
            <ScrollArea className="h-full w-full pr-4">
              <div className="space-y-4">
                {events.map((event) => (
                  <div key={event.id} className="flex items-start gap-4 p-3 border rounded-md bg-muted/50">
                    {getEventIcon(event.event_type)}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{event.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(event.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
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