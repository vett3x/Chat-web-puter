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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ShieldAlert, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Alert {
  id: string;
  created_at: string;
  event_type: string;
  description: string;
  command_details: string | null;
  server_name: string;
}

interface AlertsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AlertsDialog({ open, onOpenChange }: AlertsDialogProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/alerts');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al cargar las alertas.');
      }
      const data: Alert[] = await response.json();
      setAlerts(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchAlerts();
    }
  }, [open, fetchAlerts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[90vw] p-6 h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-destructive" /> Alertas Críticas del Sistema
          </DialogTitle>
          <DialogDescription>
            Aquí se muestran los eventos críticos y errores que requieren tu atención.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 py-4 overflow-hidden">
          <div className="flex justify-end mb-2">
            <Button variant="ghost" size="icon" onClick={fetchAlerts} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
          <ScrollArea className="h-full w-full border rounded-md">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>No hay alertas críticas.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Fecha</TableHead>
                    <TableHead className="w-[200px]">Tipo de Alerta</TableHead>
                    <TableHead className="w-[150px]">Servidor</TableHead>
                    <TableHead>Descripción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((alert) => (
                    <TableRow key={alert.id} className="text-destructive/90">
                      <TableCell className="text-xs font-mono">{format(new Date(alert.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: es })}</TableCell>
                      <TableCell className="font-medium text-xs flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {alert.event_type}
                      </TableCell>
                      <TableCell className="text-xs">{alert.server_name}</TableCell>
                      <TableCell className="text-sm">
                        {alert.description}
                        {alert.command_details && (
                          <pre className="mt-2 p-2 bg-muted/50 rounded-md font-mono text-xs whitespace-pre-wrap">
                            {alert.command_details}
                          </pre>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
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