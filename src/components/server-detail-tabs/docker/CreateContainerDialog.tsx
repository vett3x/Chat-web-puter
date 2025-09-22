"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form } from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  createContainerFormSchema,
  CreateContainerFormValues,
  INITIAL_CREATE_CONTAINER_DEFAULTS,
} from './create-container-constants';
import { CreateContainerFormFields } from './CreateContainerFormFields';
import { CreateContainerStatus } from './CreateContainerStatus';
import { ContainerInstallLog } from './ContainerInstallLog';

interface CloudflareDomain {
  id: string;
  domain_name: string;
  zone_id: string;
  account_id: string;
}

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
  const [containerInstallLog, setContainerInstallLog] = useState<string | null>(null);
  const [isInstallLogOpen, setIsInstallLogOpen] = useState(false);

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
      setContainerInstallLog(null);
      setIsInstallLogOpen(false);
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
    setContainerInstallLog(null);

    try {
      setStatusMessage({ message: 'Verificando imagen Docker, creando contenedor e instalando Node.js/npm...', type: 'info' });
      setCurrentStep(2);
      const response = await fetch(`/api/servers/${serverId}/docker/containers/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, framework: 'nextjs' }),
      });
      const result = await response.json();
      if (!response.ok) {
        setContainerInstallLog(result.installLog || null);
        throw new Error(result.message || 'Error al crear el contenedor.');
      }
      
      setStatusMessage({ message: 'Contenedor creado y Node.js/npm instalados exitosamente.', type: 'success' });
      setCurrentStep(3);
      setContainerInstallLog(result.installLog || null);
      setIsInstallLogOpen(true);

      if (values.cloudflare_domain_id && values.container_port && canManageCloudflareTunnels) {
        setStatusMessage({ message: 'Túnel Cloudflare iniciado (ver historial para detalles)...', type: 'info' });
        setCurrentStep(4);
      }

      toast.success('Contenedor, Node.js/npm y túnel (si aplica) creados exitosamente.');
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

  const isTunnelConfigured = !!(form.watch('cloudflare_domain_id') && form.watch('container_port') && canManageCloudflareTunnels);

  return (
    <Dialog open={open} onOpenChange={(newOpenState) => {
      if (isCreatingContainer && !newOpenState) {
        toast.info("Por favor, espera a que termine el proceso de creación.");
        return;
      }
      if (!newOpenState) {
        setStatusMessage(null);
        setContainerInstallLog(null);
        setIsInstallLogOpen(false);
      }
      onOpenChange(newOpenState);
    }}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Contenedor Next.js</DialogTitle>
          <DialogDescription>Ejecuta un nuevo contenedor Docker preconfigurado para Next.js en este servidor.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleCreateContainer)}>
            <CreateContainerFormFields
              form={form}
              isCreatingContainer={isCreatingContainer}
              isLoadingCloudflareDomains={isLoadingCloudflareDomains}
              cloudflareDomains={cloudflareDomains}
              canManageDockerContainers={canManageDockerContainers}
              canManageCloudflareTunnels={canManageCloudflareTunnels}
            />
            <CreateContainerStatus
              statusMessage={statusMessage}
              currentStep={currentStep}
              isTunnelConfigured={isTunnelConfigured}
            />
            <ContainerInstallLog
              log={containerInstallLog}
              isOpen={isInstallLogOpen}
              onOpenChange={setIsInstallLogOpen}
            />
            <DialogFooter className="mt-4">
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