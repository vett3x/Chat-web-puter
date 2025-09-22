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
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'; // Import CheckCircle2 and XCircle
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
  cloudflare_domain_id: z.string().uuid({ message: 'ID de dominio de Cloudflare inválido.' }).optional(),
  container_port: z.coerce.number().int().min(1).max(65535, { message: 'Puerto de contenedor inválido.' }).optional(),
  subdomain: z.string().regex(/^[a-z0-9-]{1,63}$/, { message: 'Subdominio inválido. Solo minúsculas, números y guiones.' }).optional(),
});
type CreateContainerFormValues = z.infer<typeof createContainerFormSchema>;

const INITIAL_CREATE_CONTAINER_DEFAULTS: CreateContainerFormValues = {
  image: 'node:lts', // Default for Next.js, changed from node:lts-alpine
  name: '',
  cloudflare_domain_id: undefined,
  container_port: 3000,
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
  const [statusMessage, setStatusMessage] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

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
      form.reset(INITIAL_CREATE_CONTAINER_DEFAULTS);
      setStatusMessage(null);
      setCurrentStep(0);
    }
  }, [open, fetchCloudflareDomains, form]);

  useEffect(() => {
    if (open && !isLoadingCloudflareDomains && cloudflareDomains.length > 0 && canManageCloudflareTunnels) {
      if (!form.getValues('cloudflare_domain_id')) {
        form.setValue('cloudflare_domain_id', cloudflareDomains[0].id, { shouldValidate: true });
      }
    } else if (open && !isLoadingCloudflareDomains && cloudflareDomains.length === 0) {
      form.setValue('cloudflare_domain_id', undefined, { shouldValidate: true });
    }
  }, [open, isLoadingCloudflareDomains, cloudflareDomains, canManageCloudflareTunnels, form]);

  const handleCreateContainer: SubmitHandler<CreateContainerFormValues> = async (values) => {
    setIsCreatingContainer(true);
    setStatusMessage({ message: 'Iniciando creación del contenedor...', type: 'info' });
    setCurrentStep(1);

    try {
      // Step 1: Create Container
      setStatusMessage({ message: 'Verificando imagen Docker y creando contenedor...', type: 'info' });
      setCurrentStep(2);
      const response = await fetch(`/api/servers/${serverId}/docker/containers/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, framework: 'nextjs' }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Error al crear el contenedor.');
      }
      
      setStatusMessage({ message: 'Contenedor creado exitosamente.', type: 'success' });
      setCurrentStep(3);

      // If tunnel details were provided and user has permissions, the tunnel creation
      // is initiated on the server-side within the same API call.
      // We can't get real-time updates for it here without polling, so we'll assume
      // it's part of the "container created" phase for this UI.
      if (values.cloudflare_domain_id && values.container_port && canManageCloudflareTunnels) {
        setStatusMessage({ message: 'Túnel Cloudflare iniciado (ver historial para detalles)...', type: 'info' });
        setCurrentStep(4);
      }

      toast.success('Contenedor y túnel (si aplica) creados exitosamente.');
      onContainerCreated();
      onOpenChange(false);
      form.reset(INITIAL_CREATE_CONTAINER_DEFAULTS);
      
    } catch (error: any) {
      setStatusMessage({ message: `Error: ${error.message}`, type: 'error' });
      toast.error(error.message);
    } finally {
      setIsCreatingContainer(false);
    }
  };

  const renderStatusStep = (stepNumber: number, message: string, current: number, type: 'info' | 'success' | 'error') => {
    const isActive = current === stepNumber;
    const isCompleted = current > stepNumber;
    const isError = type === 'error' && isActive;

    return (
      <div className="flex items-center gap-2 text-sm">
        {isError ? (
          <XCircle className="h-4 w-4 text-destructive" />
        ) : isCompleted ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : isActive ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <div className="h-4 w-4 border rounded-full flex-shrink-0" />
        )}
        <span className={isError ? "text-destructive" : isCompleted ? "text-muted-foreground" : ""}>
          {message}
        </span>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear Nuevo Contenedor Next.js</DialogTitle>
          <DialogDescription>Ejecuta un nuevo contenedor Docker preconfigurado para Next.js en este servidor.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleCreateContainer)} className="space-y-4 py-4">
            <FormField control={form.control} name="image" render={({ field }) => (<FormItem><FormLabel>Imagen</FormLabel><FormControl><Input placeholder="node:lts" {...field} disabled /></FormControl><FormDescription>Imagen base para Next.js (no editable).</FormDescription><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nombre (Opcional)</FormLabel><FormControl><Input placeholder="mi-app-nextjs" {...field} /></FormControl><FormMessage /></FormItem>)} />
            
            <>
              <FormField
                control={form.control}
                name="cloudflare_domain_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dominio de Cloudflare (para túnel)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isCreatingContainer || isLoadingCloudflareDomains || cloudflareDomains.length === 0 || !canManageCloudflareTunnels}>
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

            {isCreatingContainer && statusMessage && (
              <div className="space-y-2 p-4 border rounded-md bg-muted/50">
                <h4 className="font-semibold">Progreso:</h4>
                {renderStatusStep(1, 'Iniciando proceso...', currentStep, statusMessage.type)}
                {renderStatusStep(2, 'Verificando imagen Docker y creando contenedor...', currentStep, statusMessage.type)}
                {renderStatusStep(3, 'Contenedor creado y en ejecución.', currentStep, statusMessage.type)}
                {form.getValues('cloudflare_domain_id') && form.getValues('container_port') && canManageCloudflareTunnels && (
                  renderStatusStep(4, 'Configurando túnel Cloudflare...', currentStep, statusMessage.type)
                )}
                {statusMessage.type === 'error' && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <XCircle className="h-4 w-4" />
                    <span>{statusMessage.message}</span>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline" disabled={isCreatingContainer}>Cancelar</Button></DialogClose>
              <Button type="submit" disabled={isCreatingContainer || !canManageDockerContainers}>
                {isCreatingContainer && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Contenedor Next.js
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}