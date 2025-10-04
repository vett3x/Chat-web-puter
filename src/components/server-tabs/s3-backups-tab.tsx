"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Trash2, RefreshCw, HardDrive, AlertCircle, Download, Play } from 'lucide-react';
import { toast } from 'sonner';
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

interface Backup {
  key: string;
  appName: string;
  size: number;
  lastModified: string;
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function S3BackupsTab() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState<string | null>(null);

  const fetchBackups = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/s3-backups');
      if (!response.ok) throw new Error((await response.json()).message);
      setBackups(await response.json());
    } catch (err: any) {
      toast.error(`Error al cargar backups: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const handleRunBackups = async () => {
    setIsActioning('run');
    toast.info('Iniciando proceso de backup en segundo plano...');
    try {
      const response = await fetch('/api/admin/s3-backups', { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      // Optionally refresh after a delay
      setTimeout(fetchBackups, 10000);
    } catch (err: any) {
      toast.error(`Error al iniciar backups: ${err.message}`);
    } finally {
      setIsActioning(null);
    }
  };

  const handleDelete = async (key: string) => {
    setIsActioning(key);
    try {
      const response = await fetch(`/api/admin/s3-backups?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error((await response.json()).message);
      toast.success('Backup eliminado.');
      fetchBackups();
    } catch (err: any) {
      toast.error(`Error al eliminar: ${err.message}`);
    } finally {
      setIsActioning(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><HardDrive className="h-6 w-6" /> Backups en Almacenamiento S3</CardTitle>
          <CardDescription>Gestiona los backups automáticos de los proyectos.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleRunBackups} disabled={!!isActioning}>
            {isActioning === 'run' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Ejecutar Backups Ahora
          </Button>
          <Button variant="ghost" size="icon" onClick={fetchBackups} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
          <Table>
            <TableHeader><TableRow><TableHead>Proyecto</TableHead><TableHead>Fecha del Backup</TableHead><TableHead>Tamaño</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
            <TableBody>
              {backups.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No hay backups en el almacenamiento S3.</TableCell></TableRow>
              ) : (
                backups.map((backup) => (
                  <TableRow key={backup.key}>
                    <TableCell className="font-medium">{backup.appName}</TableCell>
                    <TableCell>{format(new Date(backup.lastModified), 'dd/MM/yyyy HH:mm', { locale: es })}</TableCell>
                    <TableCell>{formatBytes(backup.size)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" disabled={true}><Download className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" disabled={isActioning === backup.key}>
                            {isActioning === backup.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>¿Eliminar este backup?</AlertDialogTitle><AlertDialogDescription>Esta acción es irreversible.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(backup.key)} className="bg-destructive">Eliminar</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}