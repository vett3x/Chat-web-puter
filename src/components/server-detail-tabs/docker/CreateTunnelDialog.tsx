"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DockerContainer } from '@/types/docker';

interface CloudflareDomain {
  id: string;
  domain_name: string;
  zone_id: string;
  account_id: string;
}

const createTunnelFormSchema = z.object({
  cloudflare_domain_id: z.string().min(1, { message: 'El dominio de Cloudflare es requerido.' }),
  container_port: z.coerce.number().int().min(1).max(65535, { message: 'Puerto de contenedor inválido.' }),
  subdomain: z.string().regex(/^[a-z0-9-]{1,63}$/, { message: 'Subdominio inválido. Solo minúsculas, números y guiones.' }).optional(),
});
type CreateTunnelFormValues = z.infer<typeof createTunnelFormSchema>;

const INITIAL_CREATE_TUNNEL_DEFAULTS: CreateTunnelFormValues = {
  cloudflare_domain_id: '',
  container_port: 80,
  subdomain: '', // Changed from undefined to empty string to fix uncontrolled input error
};

interface CreateTunnelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: { id: string };
  container: DockerContainer | null;
  onTunnelCreated: () => void;
  canManageCloudflareTunnels: boolean;
}

export function CreateTunnelDialog({ open, onOpenChange, server, container, onTunnelCreated, canManageCloudflareTunnels }: CreateTunnelDialogProps) {
  const [isCreatingTunnel, setIsCreatingTunnel] = useState(false);
  const [cloudflareDomains, setCloudflareDomains] = useState<CloudflareDomain[]>([]);
  const [isLoadingCloudflareDomains, setIsLoadingCloudflareDomains] = useState(true);

  const form = useForm<CreateTunnelFormValues>({
    resolver: zodResolver(createTunnelFormSchema),
    defaultValues: INITIAL_CREATE_TUNNEL_DEFAULTS,
  });

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
    if (open) {
      fetchCloudflareDomains();
      if (container) {
        const defaultPort = container.Ports ? parseInt(container.Ports.split('->')[1]?.split('/')[0] || '80') : 80;
        form.reset({ ...INITIAL_CREATE_TUNNEL_DEFAULTS, container_port: defaultPort });
      }
    }
  }, [open, container, fetchCloudflareDomains, form]);

  const handleCreateTunnel = async (values: CreateTunnelFormValues) => {
    if (!container) return;

    setIsCreatingTunnel(true);
    try {
      const response = await fetch(`/api/servers/${server.id}/docker/containers/${container.ID}/tunnel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Error al crear el túnel.');
      }
      
      toast.success('Túnel de Cloudflare creado y aprovisionamiento iniciado.');
      onTunnelCreated();
      onOpenChange(false);
      form.reset(INITIAL_CREATE_TUNNEL_DEFAULTS);
      
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsCreatingTunnel(false);
    }
  };

  if (!container) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear Túnel Cloudflare para {container.Names}</DialogTitle>
          <DialogDescription>
            Conecta tu contenedor Docker a Internet a través de Cloudflare Tunnel.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleCreateTunnel)} className="space-y-4 py-4">
            <FormField
              control={form.control}
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
              control={form.control}
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
              control={form.control}
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
  );
}