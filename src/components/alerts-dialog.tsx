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
import { Loader2, ShieldAlert, RefreshCw, AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useSession } from '@/components/session-context-provider';
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

interface Alert {
  id: string;
  created_at: string;
  event_type: string;
  description: string;
  command_details: string | null;
  server_name: string;
  user_name: string;
}

interface AlertsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AlertsDialog({ open, onOpenChange }: AlertsDialogProps) {
  const { userRole } = useSession();
  const isSuperAdmin = userRole === 'super_admin';

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearingAll, setIsClearingAll] = useState(false);

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

  const handleClearAllAlerts = async () => {
    setIsClearingAll(true);
    try {
      const response = await fetch('/api/alerts', { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Error al limpiar el historial.');
      }
      toast.success(result.message || 'Historial de alertas limpiado correctamente.');
      fetchAlerts(); // Refresh the list
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsClearingAll(false);
    }
  };

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
          <div className="flex justify-end gap-2 mb-2">
            {isSuperAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isLoading || isClearingAll || alerts.length === 0}>
                    {isClearingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Limpiar Todo el Historial
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro de limpiar todo el historial de alertas?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción eliminará permanentemente todos los registros de alertas críticas. Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAllAlerts} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Limpiar Todo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button variant="ghost" size="icon" onClick={fetchAlerts} disabled={isLoading || isClearingAll}>
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
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Fecha</TableHead>
                    <TableHead className="w-[220px]">Tipo de Alerta</TableHead>
                    <TableHead className="w-[150px]">Servidor</TableHead>
                    <TableHead className="w-[150px]">Usuario</TableHead>
                    <TableHead>Descripción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((alert) => (
                    <TableRow key={alert.id} className="bg-destructive/10 hover:bg-destructive/20 text-destructive-foreground">
                      <TableCell className="text-xs font-mono align-top">
                        {format(new Date(alert.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
                      </TableCell>
                      <TableCell className="font-medium text-xs align-top">
                        <div className="flex items-start gap-1">
                          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span className="break-words">{alert.event_type}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs align-top">{alert.server_name}</TableCell>
                      <TableCell className="text-xs align-top">{alert.user_name}</TableCell>
                      <TableCell className="text-sm align-top">
                        <p className="break-words">{alert.description}</p>
                        {alert.command_details && (
                          <pre className="mt-2 p-2 bg-black/20 rounded-md font-mono text-xs whitespace-pre-wrap break-all">
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
          <DialogClose asChild><Button variant="outline">Cerrar</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}