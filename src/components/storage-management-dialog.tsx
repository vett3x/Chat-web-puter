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
import { Loader2, Trash2, RefreshCw, Image as ImageIcon, File, Upload, Download, HardDrive, Folder, PlusCircle, ChevronRight, Wand2 } from 'lucide-react';
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
import { Card, CardContent, CardFooter } from '@/components/ui/card'; // Import Card components
import { Separator } from '@/components/ui/separator'; // Import Separator

const VIRTUAL_PROJECTS_FOLDER = 'Proyectos DeepAI Coder';

interface StoredItem {
  id: string | null;
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

  const isInsideProjectFolder = currentPath.startsWith(VIRTUAL_PROJECTS_FOLDER);

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
    let filesUploaded = 0;

    const uploadPromises = Array.from(files).map(async (file) => {
      const toastId = toast.loading(`Subiendo "${file.name}"...`);
      try {
        const filePath = `${session.user.id}/${currentPath ? `${currentPath}/` : ''}${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from('notes-images').upload(filePath, file);
        if (error) {
          throw new Error(error.message);
        }
        toast.success(`"${file.name}" subido correctamente.`, { id: toastId });
        filesUploaded++;
      } catch (uploadError: any) {
        toast.error(`Error al subir "${file.name}": ${uploadError.message}`, { id: toastId });
      }
    });

    await Promise.all(uploadPromises);

    if (filesUploaded > 0) {
      fetchItems(currentPath); // Refresh the list only if something was uploaded
    }

    if (event.target) {
      event.target.value = '';
    }
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

  const handleNavigate = (item: StoredItem) => {
    if (item.type !== 'folder') return;
    if (item.path.startsWith(VIRTUAL_PROJECTS_FOLDER)) {
      setCurrentPath(item.path);
    } else {
      setCurrentPath(prev => (prev ? `${prev}/${item.name}` : item.name));
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    const pathParts = currentPath.split('/');
    setCurrentPath(pathParts.slice(0, index + 1).join('/'));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[80vw] p-6 h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><HardDrive className="h-6 w-6" /> Gestión de Almacenamiento</DialogTitle>
          <DialogDescription>Navega, sube y elimina los archivos de tu cuenta.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 py-4 overflow-hidden flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-2">
            <div className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
              <Button variant="link" className="p-0 h-auto" onClick={() => setCurrentPath('')}>Raíz</Button>
              {currentPath.split('/').map((part, index) => (
                <React.Fragment key={index}>
                  <ChevronRight className="h-4 w-4" />
                  <Button variant="link" className="p-0 h-auto" onClick={() => handleBreadcrumbClick(index)}>{part === VIRTUAL_PROJECTS_FOLDER ? part : items.find(item => item.path.endsWith(part))?.name || part}</Button>
                </React.Fragment>
              ))}
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <input type="file" ref={fileInputRef} onChange={handleFileSelectAndUpload} multiple hidden />
              <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={isLoading || isUploading || isInsideProjectFolder}>{isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Subir</Button>
              <Dialog open={isNewFolderDialogOpen} onOpenChange={setIsNewFolderDialogOpen}>
                <DialogTrigger asChild><Button size="sm" variant="outline" disabled={isInsideProjectFolder}><PlusCircle className="mr-2 h-4 w-4" /> Nueva Carpeta</Button></DialogTrigger>
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
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader><TableRow><TableHead className="w-[80px]">Tipo</TableHead><TableHead>Nombre</TableHead><TableHead>Tamaño</TableHead><TableHead>Fecha</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {items.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground h-24">Esta carpeta está vacía.</TableCell></TableRow> : items.map(item => {
                          const isVirtual = item.path.startsWith(VIRTUAL_PROJECTS_FOLDER);
                          return (
                            <TableRow key={item.path} onClick={() => item.type === 'folder' && handleNavigate(item)} className={item.type === 'folder' ? 'cursor-pointer' : ''}>
                              <TableCell><div className="h-12 w-12 flex items-center justify-center bg-muted rounded-md">{item.name === VIRTUAL_PROJECTS_FOLDER ? <Wand2 className="h-6 w-6 text-primary-light-purple" /> : (item.type === 'folder' ? <Folder className="h-6 w-6 text-yellow-500" /> : (item.metadata?.mimetype.startsWith('image/') ? <img src={item.publicUrl} alt={item.name} className="h-full w-full object-cover rounded-md" /> : <File className="h-6 w-6 text-muted-foreground" />))}</div></TableCell>
                              <TableCell className="font-medium break-all">{item.name}</TableCell>
                              <TableCell>{item.type === 'file' ? formatBytes(item.metadata?.size || 0) : '--'}</TableCell>
                              <TableCell>{item.created_at ? format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: es }) : '--'}</TableCell>
                              <TableCell className="text-right"><div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>{item.type === 'file' && !isVirtual && <a href={item.publicUrl} download={item.name} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="icon" className="h-8 w-8"><Download className="h-4 w-4" /></Button></a>}<AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8" disabled={isDeleting === item.path || isVirtual}>{isDeleting === item.path ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Estás seguro?</AlertDialogTitle><AlertDialogDescription>Esta acción eliminará permanentemente "{item.name}". {item.type === 'folder' && 'Todo su contenido también será eliminado.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(item)} className="bg-destructive">Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Mobile Cards */}
                  <div className="md:hidden p-2 space-y-2">
                    {items.length === 0 ? <div className="text-center text-muted-foreground py-8">Esta carpeta está vacía.</div> : items.map(item => {
                      const isVirtual = item.path.startsWith(VIRTUAL_PROJECTS_FOLDER);
                      return (
                        <Card key={item.path} onClick={() => item.type === 'folder' && handleNavigate(item)} className={item.type === 'folder' ? 'cursor-pointer' : ''}>
                          <CardContent className="p-3 flex items-center gap-3">
                            <div className="h-12 w-12 flex-shrink-0 flex items-center justify-center bg-muted rounded-md">{item.name === VIRTUAL_PROJECTS_FOLDER ? <Wand2 className="h-6 w-6 text-primary-light-purple" /> : (item.type === 'folder' ? <Folder className="h-6 w-6 text-yellow-500" /> : (item.metadata?.mimetype.startsWith('image/') ? <img src={item.publicUrl} alt={item.name} className="h-full w-full object-cover rounded-md" /> : <File className="h-6 w-6 text-muted-foreground" />))}</div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium break-words">{item.name}</p>
                              <p className="text-xs text-muted-foreground">{item.created_at ? format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: es }) : '--'}</p>
                              <p className="text-xs text-muted-foreground">{item.type === 'file' ? formatBytes(item.metadata?.size || 0) : 'Carpeta'}</p>
                            </div>
                            <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                              {item.type === 'file' && !isVirtual && <a href={item.publicUrl} download={item.name} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="icon" className="h-8 w-8"><Download className="h-4 w-4" /></Button></a>}
                              <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8" disabled={isDeleting === item.path || isVirtual}>{isDeleting === item.path ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Estás seguro?</AlertDialogTitle><AlertDialogDescription>Esta acción eliminará permanentemente "{item.name}". {item.type === 'folder' && 'Todo su contenido también será eliminado.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(item)} className="bg-destructive">Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}
            </ScrollArea>
          </div>
        </div>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cerrar</Button></DialogClose></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}