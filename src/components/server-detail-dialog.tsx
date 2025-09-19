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
import { Server, Dock, HardDrive, Link, Loader2, RefreshCw, XCircle, Play, StopCircle, Trash2, PlusCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { DockerContainer } from '@/types/docker';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

interface RegisteredServer {
  id: string;
  name?: string;
  ip_address: string;
}

interface ServerDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: RegisteredServer;
}

const createContainerFormSchema = z.object({
  image: z.string().min(1, { message: 'El nombre de la imagen es requerido.' }),
  name: z.string().optional(),
  ports: z.string().regex(/^(\d{1,5}:\d{1,5})?$/, { message: 'Formato de puerto inválido. Use HOST:CONTAINER.' }).optional(),
});

type CreateContainerFormValues = z.infer<typeof createContainerFormSchema>;

function CreateContainerDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (values: CreateContainerFormValues) => void;
}) {
  const form = useForm<CreateContainerFormValues>({
    resolver: zodResolver(createContainerFormSchema),
    defaultValues: { image: '', name: '', ports: '' },
  });

  const onSubmit = (values: CreateContainerFormValues) => {
    onCreate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear Nuevo Contenedor</DialogTitle>
          <DialogDescription>Ejecuta un nuevo contenedor Docker en este servidor.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField control={form.control} name="image" render={({ field }) => (<FormItem><FormLabel>Imagen</FormLabel><FormControl><Input placeholder="ubuntu:latest" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nombre (Opcional)</FormLabel><FormControl><Input placeholder="mi-contenedor" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="ports" render={({ field }) => (<FormItem><FormLabel>Puertos (Opcional)</FormLabel><FormControl><Input placeholder="8080:80" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
              <Button type="submit">Crear</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ServerDetailDockerTab({ serverId }: { serverId: string }) {
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const fetchContainers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/servers/${serverId}/docker/containers`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: DockerContainer[] = await response.json();
      setContainers(data);
    } catch (err: any) {
      console.error('Error fetching Docker containers:', err);
      setError(err.message || 'Error al cargar los contenedores Docker.');
      toast.error(err.message || 'Error al cargar los contenedores Docker.');
    } finally {
      setIsLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    if (serverId) {
      fetchContainers();
    }
  }, [serverId, fetchContainers]);

  const handleContainerAction = async (containerId: string, action: 'start' | 'stop' | 'delete') => {
    setActionLoading(containerId);
    try {
      let response;
      if (action === 'delete') {
        response = await fetch(`/api/servers/${serverId}/docker/containers/${containerId}`, { method: 'DELETE' });
      } else {
        response = await fetch(`/api/servers/${serverId}/docker/containers/${containerId}/${action}`, { method: 'POST' });
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `HTTP error! status: ${response.status}`);
      toast.success(result.message || `Acción '${action}' realizada correctamente.`);
      await fetchContainers();
    } catch (err: any) {
      console.error(`Error performing ${action} on container ${containerId}:`, err);
      toast.error(err.message || `Error al realizar la acción '${action}'.`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateContainer = async (values: CreateContainerFormValues) => {
    setIsCreateDialogOpen(false);
    toast.info("Enviando comando de creación. La lista se actualizará en breve...");

    try {
      const response = await fetch(`/api/servers/${serverId}/docker/containers/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Error al crear el contenedor.');
      }
      toast.success('Comando de creación enviado. Actualizando lista...');
      await fetchContainers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2"><Dock className="h-5 w-5" /> Contenedores Docker</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Crear Contenedor</Button>
            <Button variant="ghost" size="icon" onClick={fetchContainers} disabled={isLoading || actionLoading !== null} title="Refrescar">{isLoading || actionLoading !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Cargando contenedores...</p></div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-destructive"><XCircle className="h-6 w-6 mr-2" /><p>{error}</p></div>
          ) : containers.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground"><p>No se encontraron contenedores Docker en este servidor.</p></div>
          ) : (
            <ScrollArea className="h-full w-full">
              <Table>
                <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Nombre</TableHead><TableHead>Imagen</TableHead><TableHead>Estado</TableHead><TableHead>Puertos</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                <TableBody>
                  {containers.map((container) => {
                    const isRunning = container.Status.includes('Up');
                    const isActionInProgress = actionLoading === container.ID;
                    return (
                      <TableRow key={container.ID}>
                        <TableCell className="font-mono text-xs">{container.ID.substring(0, 12)}</TableCell>
                        <TableCell>{container.Names}</TableCell>
                        <TableCell>{container.Image}</TableCell>
                        <TableCell>{container.Status}</TableCell>
                        <TableCell>{container.Ports || '-'}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={isActionInProgress}>{isActionInProgress ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Acciones</Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleContainerAction(container.ID, 'start')} disabled={isRunning || isActionInProgress}><Play className="mr-2 h-4 w-4" /> Iniciar</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleContainerAction(container.ID, 'stop')} disabled={!isRunning || isActionInProgress}><StopCircle className="mr-2 h-4 w-4" /> Detener</DropdownMenuItem>
                              <AlertDialog>
                                <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={isActionInProgress} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Eliminar</DropdownMenuItem></AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>¿Estás seguro de eliminar este contenedor?</AlertDialogTitle><AlertDialogDescription>Esta acción eliminará permanentemente el contenedor "{container.Names}" ({container.ID.substring(0, 12)}).</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleContainerAction(container.ID, 'delete')} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      <CreateContainerDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreate={handleCreateContainer}
      />
    </>
  );
}

function ServerDetailResourcesTab({ serverId }: { serverId: string }) {
  return (
    <Card className="h-full"><CardHeader><CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" /> Uso de Recursos</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Mostrando uso de CPU, RAM, Disco para el servidor: {serverId}</p><p className="text-sm text-muted-foreground mt-2">(Gráficos y métricas en desarrollo)</p></CardContent></Card>
  );
}

function ServerDetailWebLinksTab({ serverId }: { serverId: string }) {
  return (
    <Card className="h-full"><CardHeader><CardTitle className="flex items-center gap-2"><Link className="h-5 w-5" /> Enlaces Web</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Mostrando enlaces a aplicaciones web desplegadas en el servidor: {serverId}</p><p className="text-sm text-muted-foreground mt-2">(Listado de URLs y estados en desarrollo)</p></CardContent></Card>
  );
}

export function ServerDetailDialog({ open, onOpenChange, server }: ServerDetailDialogProps) {
  const [activeTab, setActiveTab] = useState('docker');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] p-6 h-[90vh] flex flex-col">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Server className="h-6 w-6" /> Detalles del Servidor: {server.name || server.ip_address}</DialogTitle><DialogDescription>Información detallada y gestión avanzada para el servidor {server.ip_address}.</DialogDescription></DialogHeader>
        <div className="flex-1 py-4 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="docker" className="flex items-center gap-2"><Dock className="h-4 w-4" /> Docker</TabsTrigger><TabsTrigger value="resources" className="flex items-center gap-2"><HardDrive className="h-4 w-4" /> Recursos</TabsTrigger><TabsTrigger value="weblinks" className="flex items-center gap-2"><Link className="h-4 w-4" /> Web</TabsTrigger></TabsList>
            <div className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-full w-full">
                <TabsContent value="docker" className="h-full"><ServerDetailDockerTab serverId={server.id} /></TabsContent>
                <TabsContent value="resources" className="h-full"><ServerDetailResourcesTab serverId={server.id} /></TabsContent>
                <TabsContent value="weblinks" className="h-full"><ServerDetailWebLinksTab serverId={server.id} /></TabsContent>
              </ScrollArea>
            </div>
          </Tabs>
        </div>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cerrar</Button></DialogClose></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}