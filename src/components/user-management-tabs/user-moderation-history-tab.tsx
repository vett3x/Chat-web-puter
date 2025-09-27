"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Shield, RefreshCw, AlertCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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

interface ModerationLog {
  id: string;
  created_at: string;
  action: string;
  reason: string;
  moderator_name: string;
}

interface UserModerationHistoryTabProps {
  userId: string;
  currentUserRole: 'user' | 'admin' | 'super_admin' | null;
}

export function UserModerationHistoryTab({ userId, currentUserRole }: UserModerationHistoryTabProps) {
  const [logs, setLogs] = useState<ModerationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isSuperAdmin = currentUserRole === 'super_admin';

  const fetchModerationHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/users/${userId}/moderation-history`, { credentials: 'include' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: ModerationLog[] = await response.json();
      setLogs(data);
    } catch (err: any) {
      console.error(`Error fetching moderation history for user ${userId}:`, err);
      setError(err.message || 'Error al cargar el historial de moderación.');
      toast.error(err.message || 'Error al cargar el historial de moderación.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchModerationHistory();
    }
  }, [userId, fetchModerationHistory]);

  const handleClearHistory = async () => {
    try {
      const response = await fetch(`/api/users/${userId}/moderation-history`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }
      toast.success(result.message || 'Historial de moderación limpiado correctamente.');
      fetchModerationHistory(); // Refresh the list
    } catch (err: any) {
      console.error('Error clearing moderation history:', err);
      toast.error(err.message || 'Error al limpiar el historial de moderación.');
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" /> Historial de Moderación
        </CardTitle>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isLoading || logs.length === 0}>
                  <Trash2 className="mr-2 h-4 w-4" /> Limpiar Historial
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Estás seguro de limpiar el historial de moderación?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción eliminará permanentemente todos los registros de moderación para este usuario. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Limpiar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="ghost" size="icon" onClick={fetchModerationHistory} disabled={isLoading} title="Refrescar">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Cargando historial...</p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-destructive">
            <AlertCircle className="h-6 w-6 mr-2" />
            <p>{error}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>Este usuario no tiene historial de moderación.</p>
          </div>
        ) : (
          <ScrollArea className="h-full w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Fecha</TableHead>
                  <TableHead className="w-[120px]">Acción</TableHead>
                  <TableHead className="w-[200px]">Moderador</TableHead>
                  <TableHead>Razón</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs font-mono">
                      {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
                    </TableCell>
                    <TableCell className="font-medium capitalize">{log.action}</TableCell>
                    <TableCell>{log.moderator_name}</TableCell>
                    <TableCell className="text-sm whitespace-pre-wrap">{log.reason}</TableCell>
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