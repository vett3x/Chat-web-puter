"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Cloud, PlusCircle, Loader2, Trash2, RefreshCw, AlertCircle, CheckCircle2, Globe } from 'lucide-react';
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
  FormDescription,
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
import { cn } from '@/lib/utils';
import { useSession } from '@/components/session-context-provider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

// Tipos para los datos de Cloudflare
interface CloudflareDomain {
  id: string;
  domain_name: string;
  api_token: string;
  zone_id: string;
  account_id: string;
  created_at: string;
}

interface DockerTunnel {
  id: string;
  server_id: string;
  container_id: string;
  full_domain: string;
  container_port: number;
  status: 'pending' | 'provisioning' | 'active' | 'failed';
  created_at: string;
  domain_name: string;
  server_name: string;
}

// Esquema de validación para añadir un dominio de Cloudflare
const cloudflareDomainSchema = z.object({
  domain_name: z.string().min(1, { message: 'El nombre de dominio es requerido.' }).regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, { message: 'Formato de dominio inválido.' }),
  api_token: z.string().min(1, { message: 'El API Token es requerido.' }),
  zone_id: z.string().min(1, { message: 'El Zone ID es requerido.' }),
  account_id: z.string().min(1, { message: 'El Account ID es requerido.' }),
});

type CloudflareDomainFormValues = z.infer<typeof cloudflareDomainSchema>;

export function CloudflareTunnelTab() {
  const { userPermissions } = useSession();
  const canManageCloudflareDomains = userPermissions['can_manage_cloudflare_domains'];

  const [cloudflareDomains, setCloudflareDomains] = useState<CloudflareDomain[]>([]);
  const [dockerTunnels, setDockerTunnels] = useState<DockerTunnel[]>([]);
  const [isLoadingDomains, setIsLoadingDomains] = useState(true);
  const [isLoadingTunnels, setIsLoadingTunnels] = useState(true);
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [errorDomains, setErrorDomains] = useState<string | null>(null);
  const [errorTunnels, setErrorTunnels] = useState<string | null>(null);
  const [isAddDomainDialogOpen, setIsAddDomainDialogOpen] = useState(false);

  const domainForm = useForm<CloudflareDomainFormValues>({
    resolver: zodResolver(cloudflareDomainSchema),
    defaultValues: {
      domain_name: '',
      api_token: '',
      zone_id: '',
      account_id: '',
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
      const response = await fetch('/api/cloudflare/tunnels', { credentials: 'include' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: DockerTunnel[] = await response.json();
      setDockerTunnels(data);
    } catch (err: any) {
      console.error('Error fetching Docker tunnels:', err);
      setErrorTunnels(err.message || 'Error al cargar los túneles Docker.');
    } finally {
      setIsLoadingTunnels(false);
    }
  }, []);

  useEffect(() => {
    fetchCloudflareDomains();
    fetchDockerTunnels();
  }, [fetchCloudflareDomains, fetchDockerTunnels]);

  const handleAddDomain = async (values: CloudflareDomainFormValues) => {
    setIsAddingDomain(true);
    try {
      const trimmedValues = {
        domain_name: values.domain_name.trim(),
        api_token: values.api_token.trim(),
        zone_id: values.zone_id.trim(),
        account_id: values.account_id.trim(),
      };

      const response = await fetch('/api/cloudflare/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trimmedValues),
        credentials: 'include',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }
      toast.success(result.message || 'Dominio de Cloudflare añadido correctamente.');
      domainForm.reset();
      fetchCloudflareDomains();
      setIsAddDomainDialogOpen(false);
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
    <div className="space-y-8 p-1">
      {/* Registered Cloudflare Domains */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-6 w-6" /> Dominios de Cloudflare Registrados
          </CardTitle>
          <div className="flex items-center gap-2">
            <Dialog open={isAddDomainDialogOpen} onOpenChange={setIsAddDomainDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!canManageCloudflareDomains}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Añadir Dominio
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                  <DialogTitle>Añadir Dominio de Cloudflare</DialogTitle>
                  <DialogDescription>
                    Introduce los detalles de tu dominio de Cloudflare para poder crear túneles.
                  </DialogDescription>
                </DialogHeader>
                <Form {...domainForm}>
                  <form onSubmit={domainForm.handleSubmit(handleAddDomain)} className="space-y-4 py-4">
                    <FormField control={domainForm.control} name="domain_name" render={({ field }) => (<FormItem><FormLabel>Nombre de Dominio (ej. example.com)</FormLabel><FormControl><Input placeholder="tudominio.com" {...field} disabled={isAddingDomain} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={domainForm.control} name="api_token" render={({ field }) => (<FormItem><FormLabel>Cloudflare API Token</FormLabel><FormControl><Input type="password" placeholder="Tu API Token de Cloudflare" {...field} disabled={isAddingDomain} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={domainForm.control} name="zone_id" render={({ field }) => (<FormItem><FormLabel>Cloudflare Zone ID</FormLabel><FormControl><Input placeholder="Tu Zone ID de Cloudflare" {...field} disabled={isAddingDomain} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={domainForm.control} name="account_id" render={({ field }) => (<FormItem><FormLabel>Cloudflare Account ID</FormLabel><FormControl><Input placeholder="Tu Account ID de Cloudflare" {...field} disabled={isAddingDomain} /></FormControl><FormDescription>Puedes encontrar tu Account ID en la página de resumen de tu dominio en Cloudflare, en la barra lateral derecha.</FormDescription><FormMessage /></FormItem>)} />
                    <DialogFooter>
                      <DialogClose asChild><Button type="button" variant="outline" disabled={isAddingDomain}>Cancelar</Button></DialogClose>
                      <Button type="submit" disabled={isAddingDomain}>
                        {isAddingDomain ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                        Añadir Dominio
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="icon" onClick={fetchCloudflareDomains} disabled={isLoadingDomains} title="Refrescar">
              {isLoadingDomains ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingDomains ? (
            <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Cargando dominios...</p></div>
          ) : errorDomains ? (
            <div className="flex items-center justify-center h-full text-destructive"><AlertCircle className="h-6 w-6 mr-2" /><p>{errorDomains}</p></div>
          ) : cloudflareDomains.length === 0 ? (
            <p className="text-muted-foreground">No hay dominios de Cloudflare registrados aún.</p>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader><TableRow><TableHead>Dominio</TableHead><TableHead>Zone ID</TableHead><TableHead>Account ID</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {cloudflareDomains.map((domain) => (
                      <TableRow key={domain.id}>
                        <TableCell className="font-medium">{domain.domain_name}</TableCell><TableCell className="font-mono text-xs">{domain.zone_id}</TableCell><TableCell className="font-mono text-xs">{domain.account_id}</TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8" disabled={!canManageCloudflareDomains}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>¿Estás seguro de eliminar este dominio?</AlertDialogTitle><AlertDialogDescription>Esta acción eliminará el dominio "{domain.domain_name}" y todos los túneles asociados a él.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteDomain(domain.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {cloudflareDomains.map((domain) => (
                  <Card key={domain.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <h4 className="font-semibold break-all">{domain.domain_name}</h4>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8 flex-shrink-0" disabled={!canManageCloudflareDomains}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>¿Estás seguro de eliminar este dominio?</AlertDialogTitle><AlertDialogDescription>Esta acción eliminará el dominio "{domain.domain_name}" y todos los túneles asociados a él.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteDomain(domain.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">Zone ID: {domain.zone_id}</p>
                      <p className="text-xs text-muted-foreground font-mono">Account ID: {domain.account_id}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Docker Tunnels */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2"><Cloud className="h-6 w-6" /> Túneles Docker de Cloudflare</CardTitle>
          <Button variant="ghost" size="icon" onClick={fetchDockerTunnels} disabled={isLoadingTunnels} title="Refrescar">
            {isLoadingTunnels ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoadingTunnels ? (
            <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Cargando túneles...</p></div>
          ) : errorTunnels ? (
            <div className="flex items-center justify-center h-full text-destructive"><AlertCircle className="h-6 w-6 mr-2" /><p>{errorTunnels}</p></div>
          ) : dockerTunnels.length === 0 ? (
            <p className="text-muted-foreground">No hay túneles Docker de Cloudflare configurados aún.</p>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader><TableRow><TableHead>Dominio Completo</TableHead><TableHead>Servidor</TableHead><TableHead>Contenedor</TableHead><TableHead>Puerto</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {dockerTunnels.map((tunnel) => (
                      <TableRow key={tunnel.id}>
                        <TableCell className="font-medium"><a href={`https://${tunnel.full_domain}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1"><Globe className="h-4 w-4" /> {tunnel.full_domain}</a></TableCell>
                        <TableCell>{tunnel.server_name}</TableCell>
                        <TableCell className="font-mono text-xs">{tunnel.container_id?.substring(0, 12) || 'N/A'}</TableCell>
                        <TableCell>{tunnel.container_port}</TableCell>
                        <TableCell>
                          <span className={cn("flex items-center gap-1", tunnel.status === 'active' && "text-green-500", tunnel.status === 'failed' && "text-destructive", (tunnel.status === 'pending' || tunnel.status === 'provisioning') && "text-blue-500")}>
                            {tunnel.status === 'active' && <CheckCircle2 className="h-4 w-4" />}
                            {tunnel.status === 'failed' && <AlertCircle className="h-4 w-4" />}
                            {(tunnel.status === 'pending' || tunnel.status === 'provisioning') && <Loader2 className="h-4 w-4 animate-spin" />}
                            {tunnel.status === 'pending' && 'Pendiente'}
                            {tunnel.status === 'provisioning' && 'Aprovisionando'}
                            {tunnel.status === 'active' && 'Activo'}
                            {tunnel.status === 'failed' && 'Fallido'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right"><Button variant="destructive" size="icon" className="h-8 w-8" disabled={!canManageCloudflareDomains}><Trash2 className="h-4 w-4" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {dockerTunnels.map((tunnel) => (
                  <Card key={tunnel.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <a href={`https://${tunnel.full_domain}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1 font-semibold break-all">
                          <Globe className="h-4 w-4" /> {tunnel.full_domain}
                        </a>
                        <Button variant="destructive" size="icon" className="h-8 w-8 flex-shrink-0" disabled={!canManageCloudflareDomains}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                      <p className="text-sm text-muted-foreground">Servidor: {tunnel.server_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">Contenedor: {tunnel.container_id?.substring(0, 12) || 'N/A'}</p>
                      <div className="flex items-center justify-between text-sm">
                        <span>Puerto: {tunnel.container_port}</span>
                        <span className={cn("flex items-center gap-1", tunnel.status === 'active' && "text-green-500", tunnel.status === 'failed' && "text-destructive", (tunnel.status === 'pending' || tunnel.status === 'provisioning') && "text-blue-500")}>
                          {tunnel.status === 'active' && <CheckCircle2 className="h-4 w-4" />}
                          {tunnel.status === 'failed' && <AlertCircle className="h-4 w-4" />}
                          {(tunnel.status === 'pending' || tunnel.status === 'provisioning') && <Loader2 className="h-4 w-4 animate-spin" />}
                          {tunnel.status === 'pending' && 'Pendiente'}
                          {tunnel.status === 'provisioning' && 'Aprovisionando'}
                          {tunnel.status === 'active' && 'Activo'}
                          {tunnel.status === 'failed' && 'Fallido'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}