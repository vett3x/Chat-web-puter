"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useForm, SubmitHandler } from 'react-hook-form';
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

interface CloudflareDomain {
  id: string;
  domain_name: string;
  zone_id: string;
  account_id: string;
}

const createContainerFormSchema = z.object({
  image: z.string().min(1, { message: 'La imagen es requerida.' }),
  name: z.string().optional(),
  ports: z.string().optional(),
  framework: z.enum(['nextjs', 'other']),
  cloudflare_domain_id: z.string().uuid({ message: 'ID de dominio de Cloudflare inválido.' }).optional(),
  container_port: z.coerce.number().int().min(1).max(65535, { message: 'Puerto de contenedor inválido.' }).optional(),
  subdomain: z.string().regex(/^[a-z0-9-]{1,63}$/, { message: 'Subdominio inválido. Solo minúsculas, números y guiones.' }).optional(),
});
type CreateContainerFormValues = z.infer<typeof createContainerFormSchema>;

const INITIAL_CREATE_CONTAINER_DEFAULTS: CreateContainerFormValues = {
  image: '',
  name: undefined,
  ports: undefined,
  framework: 'other',
  cloudflare_domain_id: undefined,
  container_port: undefined,
  subdomain: undefined,
};

interface CreateContainerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: string;
  onContainerCreated: () => void;
  canManageDockerContainers: boolean;
  canManageCloudflareTunnels: boolean;
}

export function CreateContainerDialog({ open, onOpenChange, serverId, onContainerCreated, canManageDockerContainers, canManageCloudflareTunnels }: CreateContainerDialogProps) {
  const [isCreatingContainer, setIsCreatingContainer] = useState(false);
  const [cloudflareDomains, setCloudflareDomains] = useState<CloudflareDomain[]>([]);
  const [isLoadingCloudflareDomains, setIsLoadingCloudflareDomains] = useState(true);

  const form = useForm<CreateContainerFormValues>({
    resolver: zodResolver(createContainerFormSchema),
    defaultValues: INITIAL_CREATE_CONTAINER_DEFAULTS,
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
      toast.error('Error al cargar los dominios de Cloudflare.');
    } finally {
      setIsLoadingCloudflareDomains(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchCloudflareDomains();
    }
  }, [open, fetchCloudflareDomains]);

  const handleCreateContainer: SubmitHandler<CreateContainerFormValues> = async (values) => {
    setIsCreatingContainer(true);
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
      
      toast.success('Contenedor creado exitosamente.');
      onContainerCreated();
      onOpenChange(false);
      form.reset(INITIAL_CREATE_CONTAINER_DEFAULTS);
      
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsCreatingContainer(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear Nuevo Contenedor</DialogTitle>
          <DialogDescription>Ejecuta un nuevo contenedor Docker en este servidor.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleCreateContainer)} className="space-y-4 py-4">
            <FormField control={form.control} name="image" render={({ field }) => (<FormItem><FormLabel>Imagen</FormLabel><FormControl><Input placeholder="ubuntu:latest" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nombre (Opcional)</FormLabel><FormControl><Input placeholder="mi-contenedor" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="ports" render={({ field }) => (<FormItem><FormLabel>Puertos (Opcional)</FormLabel><FormControl><Input placeholder="8080:80" {...field} /></FormControl><FormMessage /></FormItem>)} />
            
            <FormField
              control={form.control}
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

            {form.watch('framework') === 'nextjs' && (
              <>
                <FormField
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
  );
}