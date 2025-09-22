"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useForm, SubmitHandler } from 'react-hook-form'; // Import SubmitHandler
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dock, PlusCircle, Loader2, Trash2, RefreshCw, AlertCircle, CheckCircle2, Play, StopCircle, Terminal, Globe, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useSession } from '@/components/session-context-provider';
import { PERMISSION_KEYS } from '@/lib/constants';
import { DockerContainer } from '@/types/docker';
import { ContainerConsoleDialog } from '@/components/container-console-dialog';

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

// Schemas and types for Docker tab forms
const createContainerFormSchema = z.object({
  image: z.string().min(1, { message: 'La imagen es requerida.' }),
  name: z.string().optional(),
  ports: z.string().optional(), // e.g., "8080:80"
  framework: z.enum(['nextjs', 'other']), // Changed: Removed .default('other')
  cloudflare_domain_id: z.string().uuid({ message: 'ID de dominio de Cloudflare inválido.' }).optional(),
  container_port: z.coerce.number().int().min(1).max(65535, { message: 'Puerto de contenedor inválido.' }).optional(),
  subdomain: z.string().regex(/^[a-z0-9-]{1,63}$/, { message: 'Subdominio inválido. Solo minúsculas, números y guiones.' }).optional(),
});
type CreateContainerFormValues = z.infer<typeof createContainerFormSchema>; // Infer type directly

const createTunnelFormSchema = z.object({
  cloudflare_domain_id: z.string().min(1, { message: 'El dominio de Cloudflare es requerido.' }),
  container_port: z.coerce.number().int().min(1).max(65535, { message: 'Puerto de contenedor inválido.' }),
  subdomain: z.string().regex(/^[a-z0-9-]{1,63}$/, { message: 'Subdominio inválido. Solo minúsculas, números y guiones.' }).optional(),
});
type CreateTunnelFormValues = z.infer<typeof createTunnelFormSchema>;

// Define initial default values as constants
const INITIAL_CREATE_CONTAINER_DEFAULTS: CreateContainerFormValues = {
  image: '',
  name: undefined,
  ports: undefined,
  framework: 'other', // Explicitly set default
  cloudflare_domain_id: undefined,
  container_port: undefined,
  subdomain: undefined,
};

const INITIAL_CREATE_TUNNEL_DEFAULTS: CreateTunnelFormValues = {
  cloudflare_domain_id: '',
  container_port: 80,
  subdomain: undefined,
};

interface ServerDetailDockerTabProps {
  server: RegisteredServer;
  userRole: 'user' | 'admin' | 'super_admin' | null; // Added userRole prop
}

export function ServerDetailDockerTab({ server, userRole }: ServerDetailDockerTabProps) {
  const { userPermissions } = useSession();
  const canManageDockerContainers = userPermissions[PERMISSION_KEYS.CAN_MANAGE_DOCKER_CONTAINERS];
  const canManageCloudflareTunnels = userPermissions[PERMISSION_KEYS.CAN_MANAGE_CLOUDFLARE_TUNNELS];

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
    defaultValues: INITIAL_CREATE_CONTAINER_DEFAULTS,
  });

  const createTunnelForm = useForm<CreateTunnelFormValues>({
    resolver: zodResolver(createTunnelFormSchema),
    defaultValues: INITIAL_CREATE_TUNNEL_DEFAULTS,
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

  const handleCreateContainer: SubmitHandler<CreateContainerFormValues> = async (values) => {
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
      createContainerForm.reset(INITIAL_CREATE_CONTAINER_DEFAULTS); // Reset with default values
      
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
      createTunnelForm.reset(INITIAL_CREATE_TUNNEL_DEFAULTS); // Reset with default values
      
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
    createTunnelForm.reset({ ...INITIAL_CREATE_TUNNEL_DEFAULTS, container_port: defaultPort });
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
                <Button size="sm" disabled={!canManageDockerContainers}><PlusCircle className="mr-2 h-4 w-4" /> Crear Contenedor</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crear Nuevo Contenedor</DialogTitle>
                  <DialogDescription>Ejecuta un nuevo contenedor Docker en este servidor.</DialogDescription>
                </DialogHeader>
                <Form<CreateContainerFormValues> {...createContainerForm}>
                  <form onSubmit={createContainerForm.handleSubmit(handleCreateContainer)} className="space-y-4 py-4">
                    <FormField control={createContainerForm.control} name="image" render={({ field }) => (<FormItem><FormLabel>Imagen</FormLabel><FormControl><Input placeholder="ubuntu:latest" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={createContainerForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nombre (Opcional)</FormLabel><FormControl><Input placeholder="mi-contenedor" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={createContainerForm.control} name="ports" render={({ field }) => (<FormItem><FormLabel>Puertos (Opcional)</FormLabel><FormControl><Input placeholder="8080:80" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    
                    <FormField
                      control={createContainerForm.control}
                      name="framework"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Framework</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isCreatingContainer}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona un framework" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="nextjs">Next.js</SelectItem>
                              <SelectItem value="other">Otro</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Selecciona el framework para configurar el entorno del contenedor.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {createContainerForm.watch('framework') === 'nextjs' && (
                      <>
                        <FormField
                          control={createContainerForm.control}
                          name="cloudflare_domain_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Dominio de Cloudflare (para túnel)</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isCreatingContainer || isLoadingCloudflareDomains || cloudflareDomains.length === 0 || !canManageCloudflareTunnels}>
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
                              <FormDescription>
                                Se usará para crear un túnel Cloudflare automáticamente.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={createContainerForm.control}
                          name="container_port"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Puerto Interno del Contenedor (para túnel)</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="3000" {...field} disabled={isCreatingContainer || !canManageCloudflareTunnels} />
                              </FormControl>
                              <FormDescription>
                                El puerto interno del contenedor al que Cloudflare Tunnel debe redirigir (ej. 3000 para Next.js).
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={createContainerForm.control}
                          name="subdomain"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Subdominio (Opcional, para túnel)</FormLabel>
                              <FormControl>
                                <Input placeholder="mi-app-nextjs" {...field} disabled={isCreatingContainer || !canManageCloudflareTunnels} />
                              </FormControl>
                              <FormDescription>
                                Si se deja vacío, se generará un subdominio aleatorio.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    <DialogFooter>
                      <DialogClose asChild><Button type="button" variant="outline" disabled={isCreatingContainer}>Cancelar</Button></DialogClose>
                      <Button type="submit" disabled={isCreatingContainer || !canManageDockerContainers}>
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
              <TooltipProvider>
                <Table>
                  <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Nombre</TableHead><TableHead>Imagen</TableHead><TableHead>Estado</TableHead><TableHead>Puertos</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {containers.map((container) => {
                      const isRunning = container.Status.includes('Up');
                      const isGracefullyExited = container.Status.includes('Exited (0)') || container.Status.includes('Exited (137)');
                      const isErrorState = !isRunning && !isGracefullyExited;
                      const isWarningState = !isRunning && isGracefullyExited;

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
                          <TableCell className="align-middle">
                            <div className="flex items-center gap-1">
                              {(isErrorState || isWarningState) && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
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
                              <span>{container.Status}</span>
                            </div>
                          </TableCell>
                          <TableCell>{container.Ports || '-'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="outline" size="icon" onClick={() => openConsoleFor(container)} title="Abrir consola" disabled={!canManageDockerContainers}>
                                <Terminal className="h-4 w-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={isActionInProgress || !canManageDockerContainers}>{isActionInProgress ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Acciones</Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleContainerAction(container.ID, 'start')} disabled={isRunning || isActionInProgress || !canManageDockerContainers}><Play className="mr-2 h-4 w-4" /> Iniciar</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleContainerAction(container.ID, 'stop')} disabled={!isRunning || isActionInProgress || !canManageDockerContainers}><StopCircle className="mr-2 h-4 w-4" /> Detener</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openCreateTunnelDialogFor(container)} disabled={isActionInProgress || isLoadingCloudflareDomains || cloudflareDomains.length === 0 || !canManageCloudflareTunnels}>
                                    <Globe className="mr-2 h-4 w-4" /> Crear Túnel Cloudflare
                                  </DropdownMenuItem>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={isActionInProgress || !canManageDockerContainers} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Eliminar</DropdownMenuItem></AlertDialogTrigger>
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
            <Form<CreateTunnelFormValues> {...createTunnelForm}>
              <form onSubmit={createTunnelForm.handleSubmit(handleCreateTunnel)} className="space-y-4 py-4">
                <FormField
                  control={createTunnelForm.control}
                  name="cloudflare_domain_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dominio de Cloudflare</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isCreatingTunnel || isLoadingCloudflareDomains || cloudflareDomains.length === 0 || !canManageCloudflareTunnels}>
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
                        <Input type="number" placeholder="80" {...field} disabled={isCreatingTunnel || !canManageCloudflareTunnels} />
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
                        <Input placeholder="mi-app" {...field} disabled={isCreatingTunnel || !canManageCloudflareTunnels} />
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
                  <Button type="submit" disabled={isCreatingTunnel || isLoadingCloudflareDomains || cloudflareDomains.length === 0 || !canManageCloudflareTunnels}>
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