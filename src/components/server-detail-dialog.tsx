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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Server, Dock, HardDrive, Link, Loader2, RefreshCw, XCircle, Play, StopCircle, Trash2, PlusCircle, Terminal, AlertCircle, Globe } from 'lucide-react';
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
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage,
  FormDescription, // Import FormDescription here
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ContainerConsoleDialog } from './container-console-dialog';
import { Progress } from '@/components/ui/progress'; // Import Progress component
import { ServerResources } from '@/types/server-resources'; // Import new type
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip, // Alias Tooltip from recharts
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils'; // Import cn utility
import {
  Tooltip, // Keep Tooltip from Shadcn/UI
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface RegisteredServer {
  id: string;
  name?: string;
  ip_address: string;
}

interface CloudflareDomain {
  id: string;
  domain_name: string;
  zone_id: string;
  account_id: string;
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

const createTunnelFormSchema = z.object({
  cloudflare_domain_id: z.string().uuid({ message: 'Debe seleccionar un dominio de Cloudflare.' }),
  container_port: z.coerce.number().int().min(1).max(65535, { message: 'Puerto de contenedor inválido.' }),
  subdomain: z.string().regex(/^[a-z0-9-]{1,63}$/, { message: 'Subdominio inválido. Solo minúsculas, números y guiones.' }).optional(),
});

type CreateTunnelFormValues = z.infer<typeof createTunnelFormSchema>;

function ServerDetailDockerTab({ server }: { server: RegisteredServer }) {
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isCreateContainerDialogOpen, setIsCreateContainerDialogOpen] = useState(false);
  const [isCreatingContainer, setIsCreatingContainer] = useState(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<DockerContainer | null>(null);

  // Tunnel creation state
  const [isCreateTunnelDialogOpen, setIsCreateTunnelDialogOpen] = useState(false);
  const [isCreatingTunnel, setIsCreatingTunnel] = useState(false);
  const [cloudflareDomains, setCloudflareDomains] = useState<CloudflareDomain[]>([]);
  const [isLoadingCloudflareDomains, setIsLoadingCloudflareDomains] = useState(true);
  const [selectedContainerForTunnel, setSelectedContainerForTunnel] = useState<DockerContainer | null>(null);

  const createContainerForm = useForm<CreateContainerFormValues>({
    resolver: zodResolver(createContainerFormSchema),
    defaultValues: { image: '', name: '', ports: '' },
  });

  const createTunnelForm = useForm<CreateTunnelFormValues>({
    resolver: zodResolver(createTunnelFormSchema),
    defaultValues: { cloudflare_domain_id: '', container_port: 80, subdomain: '' },
  });

  const fetchContainers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/servers/${server.id}/docker/containers`);
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
  }, [server.id]);

  const fetchCloudflareDomains = useCallback(async () => {
    setIsLoadingCloudflareDomains(true);
    try {
      const response = await fetch('/api/cloudflare/domains', { credentials: 'include' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: CloudflareDomain[] = await response.json();
      setCloudflareDomains(data);
    } catch (err: any) {
      console.error('Error fetching Cloudflare domains:', err);
      toast.error('Error al cargar los dominios de Cloudflare para el túnel.');
    } finally {
      setIsLoadingCloudflareDomains(false);
    }
  }, []);

  useEffect(() => {
    if (server.id) {
      fetchContainers();
      fetchCloudflareDomains();
    }
  }, [server.id, fetchContainers, fetchCloudflareDomains]);

  const handleContainerAction = async (containerId: string, action: 'start' | 'stop' | 'delete') => {
    setActionLoading(containerId);
    try {
      let response;
      if (action === 'delete') {
        response = await fetch(`/api/servers/${server.id}/docker/containers/${containerId}`, { method: 'DELETE' });
      } else {
        response = await fetch(`/api/servers/${server.id}/docker/containers/${containerId}/${action}`, { method: 'POST' });
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
    setIsCreatingContainer(true);
    try {
      const response = await fetch(`/api/servers/${server.id}/docker/containers/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Error al crear el contenedor.');
      }
      
      toast.success('Contenedor creado exitosamente.');
      await fetchContainers();
      setIsCreateContainerDialogOpen(false);
      createContainerForm.reset();
      
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsCreatingContainer(false);
    }
  };

  const handleCreateTunnel = async (values: CreateTunnelFormValues) => {
    if (!selectedContainerForTunnel) return;

    setIsCreatingTunnel(true);
    try {
      const response = await fetch(`/api/servers/${server.id}/docker/containers/${selectedContainerForTunnel.ID}/tunnel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Error al crear el túnel.');
      }
      
      toast.success('Túnel de Cloudflare creado y aprovisionamiento iniciado.');
      // No need to fetch containers, as tunnels are in a separate tab
      setIsCreateTunnelDialogOpen(false);
      createTunnelForm.reset();
      
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsCreatingTunnel(false);
    }
  };

  const openConsoleFor = (container: DockerContainer) => {
    setSelectedContainer(container);
    setIsConsoleOpen(true);
  };

  const openCreateTunnelDialogFor = (container: DockerContainer) => {
    setSelectedContainerForTunnel(container);
    setIsCreateTunnelDialogOpen(true);
    // Pre-fill container port if available, or default to 80
    const defaultPort = container.Ports ? parseInt(container.Ports.split('->')[1]?.split('/')[0] || '80') : 80;
    createTunnelForm.reset({ container_port: defaultPort, subdomain: '' });
  };

  // Filter containers for error count: only count non-running containers that are NOT gracefully exited
  const errorContainers = containers.filter(c => {
    const isRunning = c.Status.includes('Up');
    const isGracefullyExited = c.Status.includes('Exited (0)') || c.Status.includes('Exited (137)');
    return !isRunning && !isGracefullyExited;
  });

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2"><Dock className="h-5 w-5" /> Contenedores Docker</CardTitle>
          <div className="flex items-center gap-2">
            {errorContainers.length > 0 && (
              <span className="text-sm font-medium text-destructive flex items-center gap-1" title={`${errorContainers.length} contenedor(es) con problemas`}>
                <AlertCircle className="h-4 w-4" /> {errorContainers.length} Errores
              </span>
            )}
            <Dialog open={isCreateContainerDialogOpen} onOpenChange={setIsCreateContainerDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Crear Contenedor</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crear Nuevo Contenedor</DialogTitle>
                  <DialogDescription>Ejecuta un nuevo contenedor Docker en este servidor.</DialogDescription>
                </DialogHeader>
                <Form {...createContainerForm}>
                  <form onSubmit={createContainerForm.handleSubmit(handleCreateContainer)} className="space-y-4 py-4">
                    <FormField control={createContainerForm.control} name="image" render={({ field }) => (<FormItem><FormLabel>Imagen</FormLabel><FormControl><Input placeholder="ubuntu:latest" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={createContainerForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nombre (Opcional)</FormLabel><FormControl><Input placeholder="mi-contenedor" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={createContainerForm.control} name="ports" render={({ field }) => (<FormItem><FormLabel>Puertos (Opcional)</FormLabel><FormControl><Input placeholder="8080:80" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <DialogFooter>
                      <DialogClose asChild><Button type="button" variant="outline" disabled={isCreatingContainer}>Cancelar</Button></DialogClose>
                      <Button type="submit" disabled={isCreatingContainer}>
                        {isCreatingContainer && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Crear
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
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
              <TooltipProvider> {/* Moved TooltipProvider here */}
                <Table>
                  <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Nombre</TableHead><TableHead>Imagen</TableHead><TableHead>Estado</TableHead><TableHead>Puertos</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {containers.map((container) => {
                      const isRunning = container.Status.includes('Up');
                      const isGracefullyExited = container.Status.includes('Exited (0)') || container.Status.includes('Exited (137)');
                      const isErrorState = !isRunning && !isGracefullyExited; // Actual error
                      const isWarningState = !isRunning && isGracefullyExited; // Stopped by admin/gracefully

                      const isActionInProgress = actionLoading === container.ID;

                      return (
                        <TableRow 
                          key={container.ID} 
                          className={cn(
                            isErrorState && "bg-destructive/10 text-destructive hover:bg-destructive/20",
                            isWarningState && "bg-warning/10 text-warning hover:bg-warning/20"
                          )}
                        >
                          <TableCell className="font-mono text-xs">{container.ID.substring(0, 12)}</TableCell>
                          <TableCell>{container.Names}</TableCell>
                          <TableCell>{container.Image}</TableCell>
                          <TableCell className="flex items-center gap-1">
                            {(isErrorState || isWarningState) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  {/* Wrapped AlertCircle in a span */}
                                  <span>
                                    {isErrorState ? (
                                      <AlertCircle className="h-4 w-4" />
                                    ) : (
                                      <AlertCircle className="h-4 w-4 text-warning" />
                                    )}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{isErrorState ? 'Contenedor con problemas' : 'Contenedor detenido'}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {container.Status}
                          </TableCell>
                          <TableCell>{container.Ports || '-'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="outline" size="icon" onClick={() => openConsoleFor(container)} title="Abrir consola">
                                <Terminal className="h-4 w-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={isActionInProgress}>{isActionInProgress ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Acciones</Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleContainerAction(container.ID, 'start')} disabled={isRunning || isActionInProgress}><Play className="mr-2 h-4 w-4" /> Iniciar</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleContainerAction(container.ID, 'stop')} disabled={!isRunning || isActionInProgress}><StopCircle className="mr-2 h-4 w-4" /> Detener</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openCreateTunnelDialogFor(container)} disabled={isActionInProgress || isLoadingCloudflareDomains || cloudflareDomains.length === 0}>
                                    <Globe className="mr-2 h-4 w-4" /> Crear Túnel Cloudflare
                                  </DropdownMenuItem>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={isActionInProgress} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Eliminar</DropdownMenuItem></AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader><AlertDialogTitle>¿Estás seguro de eliminar este contenedor?</AlertDialogTitle><AlertDialogDescription>Esta acción eliminará permanentemente el contenedor "{container.Names}" ({container.ID.substring(0, 12)}).</AlertDialogDescription></AlertDialogHeader>
                                      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleContainerAction(container.ID, 'delete')} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction></AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TooltipProvider>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      {selectedContainer && (
        <ContainerConsoleDialog
          open={isConsoleOpen}
          onOpenChange={setIsConsoleOpen}
          server={server}
          container={selectedContainer}
        />
      )}

      {/* Create Cloudflare Tunnel Dialog */}
      {selectedContainerForTunnel && (
        <Dialog open={isCreateTunnelDialogOpen} onOpenChange={setIsCreateTunnelDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Túnel Cloudflare para {selectedContainerForTunnel.Names}</DialogTitle>
              <DialogDescription>
                Conecta tu contenedor Docker a Internet a través de Cloudflare Tunnel.
              </DialogDescription>
            </DialogHeader>
            <Form {...createTunnelForm}>
              <form onSubmit={createTunnelForm.handleSubmit(handleCreateTunnel)} className="space-y-4 py-4">
                <FormField
                  control={createTunnelForm.control}
                  name="cloudflare_domain_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dominio de Cloudflare</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isCreatingTunnel || isLoadingCloudflareDomains}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un dominio registrado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingCloudflareDomains ? (
                            <SelectItem value="loading" disabled>Cargando dominios...</SelectItem>
                          ) : cloudflareDomains.length === 0 ? (
                            <SelectItem value="no-domains" disabled>No hay dominios registrados</SelectItem>
                          ) : (
                            cloudflareDomains.map((domain) => (
                              <SelectItem key={domain.id} value={domain.id}>
                                {domain.domain_name} (Zone ID: {domain.zone_id.substring(0, 8)}...)
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createTunnelForm.control}
                  name="container_port"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Puerto del Contenedor</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="80" {...field} disabled={isCreatingTunnel} />
                      </FormControl>
                      <FormDescription>
                        El puerto interno del contenedor Docker al que Cloudflare Tunnel debe redirigir.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createTunnelForm.control}
                  name="subdomain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subdominio (Opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="mi-app" {...field} disabled={isCreatingTunnel} />
                      </FormControl>
                      <FormDescription>
                        Si se deja vacío, se generará un subdominio aleatorio de 15 caracteres.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isCreatingTunnel}>Cancelar</Button>
                  </DialogClose>
                  <Button type="submit" disabled={isCreatingTunnel || isLoadingCloudflareDomains || cloudflareDomains.length === 0}>
                    {isCreatingTunnel && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Crear Túnel
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function ServerDetailResourcesTab({ serverId }: { serverId: string }) {
  const [resources, setResources] = useState<ServerResources | null>(null);
  const [resourceHistory, setResourceHistory] = useState<ServerResources[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const POLLING_INTERVAL = 5000; // Poll every 5 seconds
  const MAX_HISTORY_POINTS = 12; // Keep last 12 points (1 minute of data)

  const fetchResources = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/servers/${serverId}/resources`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: ServerResources = await response.json();
      setResources(data);
      setResourceHistory(prev => {
        const newHistory = [...prev, data];
        return newHistory.slice(-MAX_HISTORY_POINTS); // Keep only the last N points
      });
    } catch (err: any) {
      console.error('Error fetching server resources:', err);
      setError(err.message || 'Error al cargar los recursos del servidor.');
      toast.error(err.message || 'Error al cargar los recursos del servidor.');
    } finally {
      setIsLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    if (serverId) {
      fetchResources();
      const interval = setInterval(fetchResources, POLLING_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [serverId, fetchResources]);

  const formatChartTick = (value: string) => {
    const date = new Date(value);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" /> Uso de Recursos</CardTitle>
        <Button variant="ghost" size="icon" onClick={fetchResources} disabled={isLoading} title="Refrescar">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden pt-0">
        {isLoading && !resources ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Cargando recursos...</p></div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-destructive"><XCircle className="h-6 w-6 mr-2" /><p>{error}</p></div>
        ) : resources ? (
          <ScrollArea className="h-full w-full p-1">
            <div className="space-y-6 py-4">
              {/* Current Usage */}
              <div>
                <h4 className="text-md font-semibold mb-3">Uso Actual</h4>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm font-medium mb-1">
                      <span>CPU</span>
                      <span>{resources.cpu_usage_percent.toFixed(1)}%</span>
                    </div>
                    <Progress value={resources.cpu_usage_percent} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm font-medium mb-1">
                      <span>Memoria</span>
                      <span>{resources.memory_used} / {resources.memory_total}</span>
                    </div>
                    <Progress value={(parseFloat(resources.memory_used) / parseFloat(resources.memory_total)) * 100} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm font-medium mb-1">
                      <span>Disco (Root)</span>
                      <span>{resources.disk_usage_percent.toFixed(1)}%</span>
                    </div>
                    <Progress value={resources.disk_usage_percent} className="h-2" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">Última actualización: {new Date(resources.timestamp).toLocaleTimeString()}</p>
              </div>

              {/* Historical Charts */}
              {resourceHistory.length > 1 && (
                <div>
                  <h4 className="text-md font-semibold mb-3">Historial Reciente (último minuto)</h4>
                  <div className="space-y-6">
                    {/* CPU Chart */}
                    <div className="h-[150px] w-full">
                      <h5 className="text-sm font-medium mb-1">CPU (%)</h5>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={resourceHistory} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <XAxis dataKey="timestamp" tickFormatter={formatChartTick} tick={{ fontSize: 10 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                          <RechartsTooltip labelFormatter={formatChartTick} formatter={(value: number) => `${value.toFixed(1)}%`} />
                          <Line type="monotone" dataKey="cpu_usage_percent" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Memory Chart */}
                    <div className="h-[150px] w-full">
                      <h5 className="text-sm font-medium mb-1">Memoria (%)</h5>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={resourceHistory} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <XAxis dataKey="timestamp" tickFormatter={formatChartTick} tick={{ fontSize: 10 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                          <RechartsTooltip labelFormatter={formatChartTick} formatter={(value: number, name: string, props: any) => {
                            const total = parseFloat(props.payload.memory_total);
                            const used = parseFloat(props.payload.memory_used);
                            if (isNaN(total) || isNaN(used) || total === 0) return [`N/A`, 'Uso'];
                            return [`${((used / total) * 100).toFixed(1)}% (${props.payload.memory_used} / ${props.payload.memory_total})`, 'Uso'];
                          }} />
                          <Line type="monotone" dataKey={(data: ServerResources) => (parseFloat(data.memory_used) / parseFloat(data.memory_total)) * 100} stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Disk Chart */}
                    <div className="h-[150px] w-full">
                      <h5 className="text-sm font-medium mb-1">Disco (%)</h5>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={resourceHistory} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <XAxis dataKey="timestamp" tickFormatter={formatChartTick} tick={{ fontSize: 10 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                          <RechartsTooltip labelFormatter={formatChartTick} formatter={(value: number) => `${value.toFixed(1)}%`} />
                          <Line type="monotone" dataKey="disk_usage_percent" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground"><p>No hay datos de recursos disponibles.</p></div>
        )}
      </CardContent>
    </Card>
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
                <TabsContent value="docker" className="h-full"><ServerDetailDockerTab server={server} /></TabsContent>
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