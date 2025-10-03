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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Trash2, RefreshCw, Image as ImageIcon, File, Upload, Download, HardDrive, Folder, PlusCircle, ChevronRight } from 'lucide-react';
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
import { Input } from './ui/input';

interface StoredItem {
  id: string | null; // Folders have null ID from Supabase list
  name: string;
  created_at: string;
  metadata?: {
    size: number;
    mimetype: string;
  };
  publicUrl: string;
  type: 'file' | 'folder';
  path: string;
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
  const [items, setItems] = useState<StoredItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [currentPath, setCurrentPath] = useState('');
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const fetchItems = useCallback(async (path: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/storage/files?path=${encodeURIComponent(path)}`);
      if (!response.ok) throw new Error((await response.json()).message);
      setItems(await response.json());
    } catch (err: any) {
      toast.error(`Error al cargar archivos: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchItems(currentPath);
    }
  }, [open, currentPath, fetchItems]);

  const handleFileSelectAndUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!session?.user?.id) return;
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const toastId = toast.loading(`Subiendo ${files.length} archivo(s)...`);
    let filesUploaded = 0;

    for (const file of Array.from(files)) {
      const filePath = `${session.user.id}/${currentPath ? `${currentPath}/` : ''}${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('notes-images').upload(filePath, file);
      if (error) toast.error(`Error al subir ${file.name}: ${error.message}`);
      else filesUploaded++;
    }

    toast.success(`${filesUploaded} archivo(s) subido(s).`, { id: toastId });
    fetchItems(currentPath);
    if (event.target) event.target.value = '';
    setIsUploading(false);
  };

  const handleDelete = async (item: StoredItem) => {
    setIsDeleting(item.path);
    try {
      const response = await fetch(`/api/storage/files?path=${encodeURIComponent(item.path)}&type=${item.type}`, { method: 'DELETE' });
      if (!response.ok) throw new Error((await response.json()).message);
      toast.success('Recurso eliminado.');
      fetchItems(currentPath);
    } catch (err: any) {
      toast.error(`Error al eliminar: ${err.message}`);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('El nombre de la carpeta no puede estar vacío.');
      return;
    }
    try {
      const response = await fetch('/api/storage/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentPath, folderName: newFolderName }),
      });
      if (!response.ok) throw new Error((await response.json()).message);
      toast.success('Carpeta creada.');
      setNewFolderName('');
      setIsNewFolderDialogOpen(false);
      fetchItems(currentPath);
    } catch (err: any) {
      toast.error(`Error al crear la carpeta: ${err.message}`);
    }
  };

  const handleNavigate = (folderName: string) => {
    setCurrentPath(prev => (prev ? `${prev}/${folderName}` : folderName));
  };

  const handleBreadcrumbClick = (index: number) => {
    const pathParts = currentPath.split('/');
    setCurrentPath(pathParts.slice(0, index + 1).join('/'));
  };

  const totalSize = items.filter(i => i.type === 'file').reduce((acc, file) => acc + (file.metadata?.size || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[80vw] p-6 h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><HardDrive className="h-6 w-6" /> Gestión de Almacenamiento</DialogTitle>
          <DialogDescription>Navega, sube y elimina los archivos de tu cuenta.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 py-4 overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-2 gap-2">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Button variant="link" className="p-0 h-auto" onClick={() => setCurrentPath('')}>Raíz</Button>
              {currentPath.split('/').filter(Boolean).map((part, index) => (
                <React.Fragment key={index}>
                  <ChevronRight className="h-4 w-4" />
                  <Button variant="link" className="p-0 h-auto" onClick={() => handleBreadcrumbClick(index)}>{part}</Button>
                </React.Fragment>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input type="file" ref={fileInputRef} onChange={handleFileSelectAndUpload} multiple hidden />
              <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={isLoading || isUploading}>{isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Subir</Button>
              <Dialog open={isNewFolderDialogOpen} onOpenChange={setIsNewFolderDialogOpen}>
                <DialogTrigger asChild><Button size="sm" variant="outline"><PlusCircle className="mr-2 h-4 w-4" /> Nueva Carpeta</Button></DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader><DialogTitle>Crear Nueva Carpeta</DialogTitle></DialogHeader>
                  <div className="py-4"><Input placeholder="Nombre de la carpeta..." value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()} /></div>
                  <DialogFooter><Button onClick={handleCreateFolder}>Crear</Button></DialogFooter>
                </DialogContent>
              </Dialog>
              <Button variant="ghost" size="icon" onClick={() => fetchItems(currentPath)} disabled={isLoading}><RefreshCw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden border rounded-md">
            <ScrollArea className="h-full">
              {isLoading ? <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
                <Table>
                  <TableHeader><TableRow><TableHead className="w-[80px]">Tipo</TableHead><TableHead>Nombre</TableHead><TableHead>Tamaño</TableHead><TableHead>Fecha de Subida</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {items.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground h-24">Esta carpeta está vacía.</TableCell></TableRow> : items.map(item => (
                      <TableRow key={item.path} onClick={() => item.type === 'folder' && handleNavigate(item.name)} className={item.type === 'folder' ? 'cursor-pointer' : ''}>
                        <TableCell>
                          <div className="h-12 w-12 flex items-center justify-center bg-muted rounded-md">
                            {item.type === 'folder' ? <Folder className="h-6 w-6 text-yellow-500" /> : (item.metadata?.mimetype.startsWith('image/') ? <img src={item.publicUrl} alt={item.name} className="h-full w-full object-cover rounded-md" /> : <File className="h-6 w-6 text-muted-foreground" />)}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium break-all">{item.name}</TableCell>
                        <TableCell>{item.type === 'file' ? formatBytes(item.metadata?.size || 0) : '--'}</TableCell>
                        <TableCell>{item.type === 'file' && item.created_at ? format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: es }) : '--'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {item.type === 'file' && <a href={item.publicUrl} download={item.name} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="icon" className="h-8 w-8"><Download className="h-4 w-4" /></Button></a>}
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8" disabled={isDeleting === item.path}>{isDeleting === item.path ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>¿Estás seguro?</AlertDialogTitle><AlertDialogDescription>Esta acción eliminará permanentemente "{item.name}". {item.type === 'folder' && 'Todo su contenido también será eliminado.'}</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(item)} className="bg-destructive">Eliminar</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </div>
        </div>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cerrar</Button></DialogClose></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}