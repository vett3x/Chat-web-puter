"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Cloud, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

const cloudflareDomainSchema = z.object({
  domain_name: z.string().min(1, { message: 'El nombre de dominio es requerido.' }).regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, { message: 'Formato de dominio inválido.' }),
  api_token: z.string().min(1, { message: 'El API Token es requerido.' }),
  zone_id: z.string().min(1, { message: 'El Zone ID es requerido.' }),
  account_id: z.string().min(1, { message: 'El Account ID es requerido.' }),
});

type CloudflareDomainFormValues = z.infer<typeof cloudflareDomainSchema>;

interface RegisteredDomain {
  id: string;
  domain_name: string;
  zone_id: string;
  account_id: string;
}

const API_BASE_PATH = '/api/cloudflare/domains';

export function CloudflareManagementTab() {
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [domains, setDomains] = useState<RegisteredDomain[]>([]);
  const [isLoadingDomains, setIsLoadingDomains] = useState(true);
  const [isAddDomainDialogOpen, setIsAddDomainDialogOpen] = useState(false);

  const form = useForm<CloudflareDomainFormValues>({
    resolver: zodResolver(cloudflareDomainSchema),
    defaultValues: { domain_name: '', api_token: '', zone_id: '', account_id: '' },
  });

  const fetchDomains = useCallback(async () => {
    setIsLoadingDomains(true);
    try {
      const response = await fetch(API_BASE_PATH);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data: RegisteredDomain[] = await response.json();
      setDomains(data);
    } catch (error: any) {
      toast.error(`Error al cargar los dominios: ${error.message}`);
    } finally {
      setIsLoadingDomains(false);
    }
  }, []);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  const onSubmit = async (values: CloudflareDomainFormValues) => {
    setIsAddingDomain(true);
    try {
      const response = await fetch(API_BASE_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `HTTP error! status: ${response.status}`);
      toast.success(result.message || 'Dominio añadido correctamente.');
      form.reset();
      fetchDomains();
      setIsAddDomainDialogOpen(false);
    } catch (error: any) {
      toast.error(`Error al añadir el dominio: ${error.message}`);
    } finally {
      setIsAddingDomain(false);
    }
  };

  const handleDeleteDomain = async (domainId: string) => {
    try {
      const response = await fetch(`${API_BASE_PATH}?id=${domainId}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `HTTP error! status: ${response.status}`);
      toast.success(result.message || 'Dominio eliminado correctamente.');
      fetchDomains();
    } catch (error: any) {
      toast.error(`Error al eliminar el dominio: ${error.message}`);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-6 w-6" /> Gestión de Dominios Cloudflare
        </CardTitle>
        <Dialog open={isAddDomainDialogOpen} onOpenChange={setIsAddDomainDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Añadir Dominio</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Añadir Dominio de Cloudflare</DialogTitle>
              <DialogDescription>
                Introduce los detalles de tu dominio de Cloudflare para poder crear túneles.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField control={form.control} name="domain_name" render={({ field }) => (<FormItem><FormLabel>Nombre de Dominio</FormLabel><FormControl><Input placeholder="tudominio.com" {...field} disabled={isAddingDomain} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="api_token" render={({ field }) => (<FormItem><FormLabel>Cloudflare API Token</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} disabled={isAddingDomain} /></FormControl><FormDescription>Crea un token con permisos de "Zone:DNS:Edit".</FormDescription><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="zone_id" render={({ field }) => (<FormItem><FormLabel>Cloudflare Zone ID</FormLabel><FormControl><Input placeholder="Tu Zone ID" {...field} disabled={isAddingDomain} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="account_id" render={({ field }) => (<FormItem><FormLabel>Cloudflare Account ID</FormLabel><FormControl><Input placeholder="Tu Account ID" {...field} disabled={isAddingDomain} /></FormControl><FormDescription>Lo encuentras en la página de resumen de tu dominio.</FormDescription><FormMessage /></FormItem>)} />
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
      </CardHeader>
      <CardContent>
        {isLoadingDomains ? (
          <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Cargando dominios...</p></div>
        ) : domains.length === 0 ? (
          <p className="text-muted-foreground">No hay dominios de Cloudflare registrados.</p>
        ) : (
          <div className="space-y-4">
            {domains.map((domain) => (
              <div key={domain.id} className="border p-4 rounded-md bg-muted/50 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">{domain.domain_name}</h4>
                  <p className="text-sm text-muted-foreground font-mono">Zone ID: {domain.zone_id}</p>
                  <p className="text-sm text-muted-foreground font-mono">Account ID: {domain.account_id}</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar este dominio?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción eliminará el dominio "{domain.domain_name}" de la lista. No se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteDomain(domain.id)} className="bg-destructive">Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}