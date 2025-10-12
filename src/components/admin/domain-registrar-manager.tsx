"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Loader2, PlusCircle, Trash2, Edit, Save, TestTube2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

const configSchema = z.object({
  id: z.string().uuid().optional(),
  nickname: z.string().min(1, 'El apodo es requerido.'),
  provider: z.string().min(1, 'El proveedor es requerido.'),
  api_username: z.string().min(1, 'El usuario de API es requerido.'),
  api_password: z.string().optional(),
  is_active: z.boolean().optional(),
});

type ConfigFormValues = z.infer<typeof configSchema>;
interface RegistrarConfig extends ConfigFormValues {
  status: 'unverified' | 'verified' | 'failed';
}

export function DomainRegistrarManager() {
  const [configs, setConfigs] = useState<RegistrarConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingConfig, setEditingConfig] = useState<RegistrarConfig | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTestingId, setIsTestingId] = useState<string | null>(null);

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: { nickname: '', provider: 'dinahosting', api_username: '', api_password: '', is_active: false },
  });

  const fetchConfigs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/domain-registrars');
      if (!response.ok) throw new Error((await response.json()).message);
      setConfigs(await response.json());
    } catch (err: any) {
      toast.error(`Error al cargar configuraciones: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleEdit = (config: RegistrarConfig) => {
    setEditingConfig(config);
    form.reset({ ...config, api_password: '' });
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditingConfig(null);
    form.reset({ nickname: '', provider: 'dinahosting', api_username: '', api_password: '', is_active: false });
    setIsDialogOpen(true);
  };

  const onSubmit = async (values: ConfigFormValues) => {
    if (editingConfig && !values.api_password) {
      delete values.api_password;
    } else if (!editingConfig && !values.api_password) {
      form.setError('api_password', { message: 'La contraseña de API es requerida.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const method = editingConfig ? 'PUT' : 'POST';
      const response = await fetch('/api/admin/domain-registrars', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingConfig ? { ...values, id: editingConfig.id } : values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      setIsDialogOpen(false);
      fetchConfigs();
    } catch (err: any) {
      toast.error(`Error al guardar: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/domain-registrars?id=${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      fetchConfigs();
    } catch (err: any) {
      toast.error(`Error al eliminar: ${err.message}`);
    }
  };

  const handleTestConnection = async (id: string) => {
    setIsTestingId(id);
    const toastId = toast.loading('Probando conexión...');
    try {
      const response = await fetch('/api/admin/domain-registrars/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message, { id: toastId });
      fetchConfigs();
    } catch (err: any) {
      toast.error(err.message, { id: toastId, duration: 10000 });
    } finally {
      setIsTestingId(null);
    }
  };

  const handleSetActive = async (id: string) => {
    const configToActivate = configs.find(c => c.id === id);
    if (!configToActivate) return;
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/domain-registrars', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...configToActivate, is_active: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(`'${configToActivate.nickname}' ahora es el registrador activo.`);
      fetchConfigs();
    } catch (err: any) {
      toast.error(`Error al activar: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={handleAddNew}><PlusCircle className="mr-2 h-4 w-4" /> Añadir Registrador</Button>
      </div>
      {isLoading ? <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
        <Table>
          <TableHeader><TableRow><TableHead>Apodo</TableHead><TableHead>Proveedor</TableHead><TableHead>Estado</TableHead><TableHead>Activo</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
          <TableBody>
            {configs.map((config) => (
              <TableRow key={config.id}>
                <TableCell className="font-medium">{config.nickname}</TableCell>
                <TableCell>{config.provider}</TableCell>
                <TableCell>{config.status === 'verified' && <Badge><CheckCircle2 className="h-3 w-3 mr-1" /> Verificado</Badge>}{config.status === 'unverified' && <Badge variant="secondary">Sin verificar</Badge>}{config.status === 'failed' && <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Falló</Badge>}</TableCell>
                <TableCell>{config.is_active ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : null}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" onClick={() => handleTestConnection(config.id!)} disabled={!!isTestingId}>{isTestingId === config.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}</Button>
                  <Button variant="outline" size="sm" onClick={() => handleEdit(config)}><Edit className="h-4 w-4" /></Button>
                  {!config.is_active && <Button variant="outline" size="sm" onClick={() => handleSetActive(config.id!)} disabled={isSubmitting}>Activar</Button>}
                  <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Eliminar esta configuración?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(config.id!)} className="bg-destructive">Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingConfig ? 'Editar' : 'Añadir'} Configuración de Registrador</DialogTitle></DialogHeader>
          <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField control={form.control} name="nickname" render={({ field }) => (<FormItem><FormLabel>Apodo</FormLabel><FormControl><Input placeholder="Ej: Mi cuenta de Dinahosting" {...field} /></FormControl></FormItem>)} />
            <FormField control={form.control} name="provider" render={({ field }) => (<FormItem><FormLabel>Proveedor</FormLabel><FormControl><Input {...field} disabled /></FormControl></FormItem>)} />
            <FormField control={form.control} name="api_username" render={({ field }) => (<FormItem><FormLabel>Usuario de API</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
            <FormField control={form.control} name="api_password" render={({ field }) => (<FormItem><FormLabel>Contraseña de API</FormLabel><FormControl><Input type="password" placeholder={editingConfig ? "Dejar en blanco para no cambiar" : "••••••••"} {...field} /></FormControl></FormItem>)} />
            <FormField control={form.control} name="is_active" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><FormLabel>Activar esta configuración</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
            <DialogFooter><DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancelar</Button></DialogClose><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Guardar</Button></DialogFooter>
          </form></Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}