"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { Loader2, Trash2, RefreshCw, Image as ImageIcon, File, Upload, Download, HardDrive } from 'lucide-react';
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
import { useSession } from './session-context-provider';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from './ui/scroll-area';

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

interface StorageManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StorageManagementDialog({ open, onOpenChange }: StorageManagementDialogProps) {
  const { session } = useSession();
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

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
    if (open) {
      fetchFiles();
    }
  }, [open, fetchFiles]);

  const handleFileSelectAndUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!session?.user?.id) {
      toast.error("No se puede subir el archivo en este momento.");
      return;
    }

    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const toastId = toast.loading(`Subiendo ${files.length} archivo(s)...`);

    let filesUploaded = 0;

    for (const file of Array.from(files)) {
      const filePath = `${session.user.id}/${Date.now()}-${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('notes-images')
        .upload(filePath, file);

      if (uploadError) {
        console.error("Error uploading image:", uploadError);
        toast.error(`Error al subir ${file.name}: ${uploadError.message}`);
      } else {
        filesUploaded++;
      }
    }

    if (filesUploaded > 0) {
      toast.success(`${filesUploaded} archivo(s) subido(s) correctamente.`, { id: toastId });
      fetchFiles(); // Refresh the list
    } else {
      toast.dismiss(toastId);
    }

    if (event.target) {
      event.target.value = '';
    }
    setIsUploading(false);
  };

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[80vw] p-6 h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-6 w-6" /> Gestión de Almacenamiento
          </DialogTitle>
          <DialogDescription>
            Visualiza, sube y elimina los archivos de tu cuenta. Uso total: {formatBytes(totalSize)}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 py-4 overflow-hidden flex flex-col">
          <div className="flex items-center justify-end gap-2 mb-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelectAndUpload}
              multiple
              hidden
            />
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={isLoading || isUploading}>
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Subir Archivos
            </Button>
            <Button variant="ghost" size="icon" onClick={fetchFiles} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex-1 overflow-hidden border rounded-md">
            <ScrollArea className="h-full">
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
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground h-24">No has subido ningún archivo.</TableCell></TableRow>
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
                            <div className="flex items-center justify-end gap-2">
                              <a href={file.publicUrl} download={file.name} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" size="icon" className="h-8 w-8">
                                  <Download className="h-4 w-4" />
                                </Button>
                              </a>
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
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cerrar</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}