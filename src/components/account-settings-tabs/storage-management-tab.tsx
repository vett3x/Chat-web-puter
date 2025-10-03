"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Trash2, RefreshCw, Image as ImageIcon, File, AlertCircle } from 'lucide-react';
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
import { useSession } from '../session-context-provider';

interface StoredFile {
  id: string;
  name: string;
  created_at: string;
  metadata: {
    size: number;
    mimetype: string;
  };
  publicUrl: string;
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function StorageManagementTab() {
  const { session } = useSession();
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/storage/files');
      if (!response.ok) throw new Error((await response.json()).message);
      setFiles(await response.json());
    } catch (err: any) {
      toast.error(`Error al cargar archivos: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleDelete = async (filePath: string) => {
    setIsDeleting(filePath);
    try {
      const response = await fetch(`/api/storage/files?path=${encodeURIComponent(filePath)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error((await response.json()).message);
      toast.success('Archivo eliminado.');
      fetchFiles();
    } catch (err: any) {
      toast.error(`Error al eliminar: ${err.message}`);
    } finally {
      setIsDeleting(null);
    }
  };

  const totalSize = files.reduce((acc, file) => acc + file.metadata.size, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gestión de Almacenamiento</CardTitle>
            <CardDescription>
              Visualiza y elimina los archivos subidos en tus notas. Uso total: {formatBytes(totalSize)}.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchFiles} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Vista Previa</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tamaño</TableHead>
                <TableHead>Fecha de Subida</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No has subido ningún archivo.</TableCell></TableRow>
              ) : (
                files.map(file => (
                  <TableRow key={file.id}>
                    <TableCell>
                      {file.metadata.mimetype.startsWith('image/') ? (
                        <a href={file.publicUrl} target="_blank" rel="noopener noreferrer">
                          <img src={file.publicUrl} alt={file.name} className="h-12 w-12 object-cover rounded-md" />
                        </a>
                      ) : (
                        <div className="h-12 w-12 flex items-center justify-center bg-muted rounded-md">
                          <File className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium break-all">{file.name}</TableCell>
                    <TableCell>{formatBytes(file.metadata.size)}</TableCell>
                    <TableCell>{format(new Date(file.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon" className="h-8 w-8" disabled={isDeleting === `${session?.user?.id}/${file.name}`}>
                            {isDeleting === `${session?.user?.id}/${file.name}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción eliminará permanentemente el archivo "{file.name}".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(`${session?.user?.id}/${file.name}`)} className="bg-destructive">Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
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