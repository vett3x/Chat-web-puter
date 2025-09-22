"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cloud, PlusCircle, Loader2, Trash2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from '@/components/ui/form';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useSession } from '@/components/session-context-provider'; // Import useSession

// Tipos para los datos de Cloudflare
interface CloudflareDomain {
  id: string;
  domain_name: string;
  api_token: string; // Storing as plain text as per user's request for now
  zone_id: string;
  account_id: string; // Added account_id
  created_at: string;
}

interface DockerTunnel {
  id: string;
  server_id: string;
  container_id: string;
  cloudflare_domain_id: string;
  subdomain: string;
  full_domain: string;
  container_port: number;
  host_port?: number;
  tunnel_id?: string;
  tunnel_secret?: string; // Storing as plain text as per user's request for now
  status: 'pending' | 'provisioning' | 'active' | 'failed';
  provisioning_log?: string;
  created_at: string;
}

// Esquema de validación para añadir un dominio de Cloudflare
const cloudflareDomainSchema = z.object({
  domain_name: z.string().min(1, { message: 'El nombre de dominio es requerido.' }).regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, { message: 'Formato de dominio inválido.' }),
  api_token: z.string().min(1, { message: 'El API Token es requerido.' }),
  zone_id: z.string().min(1, { message: 'El Zone ID es requerido.' }),
  account_id: z.string().min(1, { message: 'El Account ID es requerido.' }), // Added account_id
});

type CloudflareDomainFormValues = z.infer<typeof cloudflareDomainSchema>;

export function CloudflareTunnelTab() {
  const { userPermissions } = useSession(); // Get user permissions
  const canManageCloudflareDomains = userPermissions['can_manage_cloudflare_domains'];

  const [cloudflareDomains, setCloudflareDomains] = useState<CloudflareDomain[]>([]);
  const [dockerTunnels, setDockerTunnels] = useState<DockerTunnel[]>([]);
  const [isLoadingDomains, setIsLoadingDomains] = useState(true);
  const [isLoadingTunnels, setIsLoadingTunnels] = useState(true);
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [errorDomains, setErrorDomains] = useState<string | null>(null);
  const [errorTunnels, setErrorTunnels] = useState<string | null>(null);

  const domainForm = useForm<CloudflareDomainFormValues>({
    resolver: zodResolver(cloudflareDomainSchema),
    defaultValues: {
      domain_name: '',
      api_token: '',
      zone_id: '',
      account_id: '', // Added default value
    },
  });

  const fetchCloudflareDomains = useCallback(async () => {
    setIsLoadingDomains(true);
    setErrorDomains(null);
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
      setErrorDomains(err.message || 'Error al cargar los dominios de Cloudflare.');
      toast.error(err.message || 'Error al cargar los dominios de Cloudflare.');
    } finally {
      setIsLoadingDomains(false);
    }
  }, []);

  const fetchDockerTunnels = useCallback(async () => {
    setIsLoadingTunnels(true);
    setErrorTunnels(null);
    try {
      // This endpoint will be created later
      const response = await fetch('/api/cloudflare/tunnels', { credentials: 'include' }); // Placeholder endpoint
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: DockerTunnel[] = await response.json();
      setDockerTunnels(data);
    } catch (err: any) {
      console.error('Error fetching Docker tunnels:', err);
      setErrorTunnels(err.message || 'Error al cargar los túneles Docker.');
      // toast.error(err.message || 'Error al cargar los túneles Docker.'); // Temporarily disable as endpoint doesn't exist yet
    } finally {
      setIsLoadingTunnels(false);
    }
  }, []);

  useEffect(() => {
    fetchCloudflareDomains();
    fetchDockerTunnels(); // Will fail until endpoint is created
  }, [fetchCloudflareDomains, fetchDockerTunnels]);

  const handleAddDomain = async (values: CloudflareDomainFormValues) => {
    setIsAddingDomain(true);
    try {
      const response = await fetch('/api/cloudflare/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        credentials: 'include',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }
      toast.success(result.message || 'Dominio de Cloudflare añadido correctamente.');
      domainForm.reset();
      fetchCloudflareDomains();
    } catch (err: any) {
      console.error('Error adding Cloudflare domain:', err);
      toast.error(err.message || 'Error al añadir el dominio de Cloudflare.');
    } finally {
      setIsAddingDomain(false);
    }
  };

  const handleDeleteDomain = async (domainId: string) => {
    try {
      const response = await fetch(`/api/cloudflare/domains?id=${domainId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }
      toast.success(result.message || 'Dominio de Cloudflare eliminado correctamente.');
      fetchCloudflareDomains();
    } catch (err: any) {
      console.error('Error deleting Cloudflare domain:', err);
      toast.error(err.message || 'Error al eliminar el dominio de Cloudflare.');
    }
  };

  return (
    <ScrollArea className="h-full w-full p-1">
      <div className="space-y-8 h-full">
        {/* Add New Cloudflare Domain */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlusCircle className="h-6 w-6" /> Añadir Dominio de Cloudflare
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!canManageCloudflareDomains ? (
              <p className="text-muted-foreground">No tienes permiso para añadir nuevos dominios de Cloudflare.</p>
            ) : (
              <Form {...domainForm}>
                <form onSubmit={domainForm.handleSubmit(handleAddDomain)} className="space-y-6">
                  <FormField
                    control={domainForm.control}
                    name="domain_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre de Dominio (ej. example.com)</FormLabel>
                        <FormControl>
                          <Input placeholder="tudominio.com" {...field} disabled={isAddingDomain} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={domainForm.control}
                    name="api_token"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cloudflare API Token</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Tu API Token de Cloudflare" {...field} disabled={isAddingDomain} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={domainForm.control}
                    name="zone_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cloudflare Zone ID</FormLabel>
                        <FormControl>
                          <Input placeholder="Tu Zone ID de Cloudflare" {...field} disabled={isAddingDomain} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={domainForm.control}
                    name="account_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cloudflare Account ID</FormLabel>
                        <FormControl>
                          <Input placeholder="Tu Account ID de Cloudflare" {...field} disabled={isAddingDomain} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isAddingDomain}>
                    {isAddingDomain ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <PlusCircle className="mr-2 h-4 w-4" />
                    )}
                    Añadir Dominio
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* Registered Cloudflare Domains */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-6 w-6" /> Dominios de Cloudflare Registrados
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={fetchCloudflareDomains} disabled={isLoadingDomains} title="Refrescar">
              {isLoadingDomains ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </CardHeader>
          <CardContent>
            {isLoadingDomains ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Cargando dominios...</p>
              </div>
            ) : errorDomains ? (
              <div className="flex items-center justify-center h-full text-destructive">
                <AlertCircle className="h-6 w-6 mr-2" />
                <p>{errorDomains}</p>
              </div>
            ) : cloudflareDomains.length === 0 ? (
              <p className="text-muted-foreground">No hay dominios de Cloudflare registrados aún.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dominio</TableHead>
                    <TableHead>Zone ID</TableHead>
                    <TableHead>Account ID</TableHead> {/* Added Account ID header */}
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cloudflareDomains.map((domain) => (
                    <TableRow key={domain.id}>
                      <TableCell className="font-medium">{domain.domain_name}</TableCell>
                      <TableCell className="font-mono text-xs">{domain.zone_id}</TableCell>
                      <TableCell className="font-mono text-xs">{domain.account_id}</TableCell> {/* Display Account ID */}
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" className="h-8 w-8" disabled={!canManageCloudflareDomains}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Estás seguro de eliminar este dominio?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción eliminará el dominio "{domain.domain_name}" y todos los túneles asociados a él.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteDomain(domain.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* Docker Tunnels */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-6 w-6" /> Túneles Docker de Cloudflare
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={fetchDockerTunnels} disabled={isLoadingTunnels} title="Refrescar">
              {isLoadingTunnels ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </CardHeader>
          <CardContent>
            {isLoadingTunnels ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Cargando túneles...</p>
              </div>
            ) : errorTunnels ? (
              <div className="flex items-center justify-center h-full text-destructive">
                <AlertCircle className="h-6 w-6 mr-2" />
                <p>{errorTunnels}</p>
              </div>
            ) : dockerTunnels.length === 0 ? (
              <p className="text-muted-foreground">No hay túneles Docker de Cloudflare configurados aún.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dominio Completo</TableHead>
                    <TableHead>Servidor</TableHead>
                    <TableHead>Contenedor</TableHead>
                    <TableHead>Puerto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dockerTunnels.map((tunnel) => (
                    <TableRow key={tunnel.id}>
                      <TableCell className="font-medium">{tunnel.full_domain}</TableCell>
                      <TableCell className="font-mono text-xs">{tunnel.server_id.substring(0, 8)}</TableCell> {/* Placeholder */}
                      <TableCell className="font-mono text-xs">{tunnel.container_id.substring(0, 8)}</TableCell> {/* Placeholder */}
                      <TableCell>{tunnel.container_port}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "flex items-center gap-1",
                          tunnel.status === 'active' && "text-green-500",
                          tunnel.status === 'failed' && "text-destructive",
                          (tunnel.status === 'pending' || tunnel.status === 'provisioning') && "text-blue-500"
                        )}>
                          {tunnel.status === 'active' && <CheckCircle2 className="h-4 w-4" />}
                          {tunnel.status === 'failed' && <AlertCircle className="h-4 w-4" />}
                          {(tunnel.status === 'pending' || tunnel.status === 'provisioning') && <Loader2 className="h-4 w-4 animate-spin" />}
                          {tunnel.status === 'pending' && 'Pendiente'}
                          {tunnel.status === 'provisioning' && 'Aprovisionando'}
                          {tunnel.status === 'active' && 'Activo'}
                          {tunnel.status === 'failed' && 'Fallido'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="destructive" size="icon" className="h-8 w-8" disabled={!canManageCloudflareDomains}> {/* Disabled based on canManageCloudflareDomains */}
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}