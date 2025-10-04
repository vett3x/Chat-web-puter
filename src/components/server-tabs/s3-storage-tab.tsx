"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Loader2, Save, Database, TestTube2, PlusCircle, Trash2, Edit, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';

const configSchema = z.object({
  id: z.string().uuid().optional(),
  nickname: z.string().min(1, 'El apodo es requerido.'),
  endpoint: z.string().url('Debe ser una URL válida.'),
  bucket_name: z.string().min(1, 'El nombre del bucket es requerido.'),
  region: z.string().min(1, 'La región es requerida.'),
  access_key_id: z.string().min(1, 'El Access Key ID es requerido.'),
  secret_access_key: z.string().optional(),
});

type ConfigFormValues = z.infer<typeof configSchema>;

interface S3Config extends ConfigFormValues {
  created_at: string;
  is_active: boolean;
  status: 'unverified' | 'verified' | 'failed';
}

export function S3StorageTab() {
  const [configs, setConfigs] = useState<S3Config[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTestingId, setIsTestingId] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<S3Config | null>(null);
  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: { nickname: '', endpoint: '', bucket_name: '', region: '', access_key_id: '', secret_access_key: '' },
  });

  const fetchConfigs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/s3-configs');
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

  const handleEdit = (config: S3Config) => {
    setEditingConfig(config);
    form.reset({ ...config, secret_access_key: '' });
    setIsAddEditDialogOpen(true);
  };

  const handleCancelEdit = () => {
    setEditingConfig(null);
    form.reset({ nickname: '', endpoint: '', bucket_name: '', region: '', access_key_id: '', secret_access_key: '' });
    setIsAddEditDialogOpen(false);
  };

  const onSubmit = async (values: ConfigFormValues) => {
    if (editingConfig && !values.secret_access_key) {
      delete values.secret_access_key;
    } else if (!editingConfig && !values.secret_access_key) {
      form.setError('secret_access_key', { message: 'La clave secreta es requerida.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const method = editingConfig ? 'PUT' : 'POST';
      const response = await fetch('/api/admin/s3-configs', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingConfig ? { ...values, id: editingConfig.id } : values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      handleCancelEdit();
      fetchConfigs();
    } catch (err: any) {
      toast.error(`Error al guardar: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestConnection = async (id: string) => {
    setIsTestingId(id);
    const toastId = toast.loading('Probando conexión...');
    try {
      const response = await fetch('/api/admin/s3-configs/test', {
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

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/s3-configs?id=${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      fetchConfigs();
    } catch (err: any) {
      toast.error(`Error al eliminar: ${err.message}`);
    }
  };

  const handleSetActive = async (id: string) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/s3-configs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(`Configuración activada.`);
      fetchConfigs();
    } catch (err: any) {
      toast.error(`Error al activar: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Configuraciones de Almacenamiento S3</CardTitle>
          <Dialog open={isAddEditDialogOpen} onOpenChange={setIsAddEditDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={handleCancelEdit}>
                <PlusCircle className="mr-2 h-4 w-4" /> Añadir Configuración
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>{editingConfig ? 'Editar' : 'Añadir'} Configuración S3</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                  <FormField control={form.control} name="nickname" render={({ field }) => (<FormItem><FormLabel>Apodo</FormLabel><FormControl><Input placeholder="Mi Bucket de Backups" {...field} disabled={isSubmitting} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="endpoint" render={({ field }) => (<FormItem><FormLabel>Endpoint URL</FormLabel><FormControl><Input placeholder="https://s3.us-east-1.amazonaws.com" {...field} disabled={isSubmitting} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="bucket_name" render={({ field }) => (<FormItem><FormLabel>Nombre del Bucket</FormLabel><FormControl><Input placeholder="mi-bucket-unico" {...field} disabled={isSubmitting} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="region" render={({ field }) => (<FormItem><FormLabel>Región</FormLabel><FormControl><Input placeholder="us-east-1" {...field} disabled={isSubmitting} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="access_key_id" render={({ field }) => (<FormItem><FormLabel>Access Key ID</FormLabel><FormControl><Input {...field} disabled={isSubmitting} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="secret_access_key" render={({ field }) => (<FormItem><FormLabel>Secret Access Key</FormLabel><FormControl><Input type="password" placeholder={editingConfig ? "Dejar en blanco para no cambiar" : "••••••••"} {...field} disabled={isSubmitting} /></FormControl></FormItem>)} />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={isSubmitting}>Cancelar</Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {editingConfig ? 'Guardar Cambios' : 'Añadir Configuración'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Apodo</TableHead><TableHead>Bucket</TableHead><TableHead>Estado</TableHead><TableHead>Activo</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
              <TableBody>
                {configs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell className="font-medium">{config.nickname}</TableCell>
                    <TableCell>{config.bucket_name}</TableCell>
                    <TableCell>
                      {config.status === 'verified' && <Badge><CheckCircle2 className="h-3 w-3 mr-1" /> Verificado</Badge>}
                      {config.status === 'unverified' && <Badge variant="secondary">Sin verificar</Badge>}
                      {config.status === 'failed' && <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Falló</Badge>}
                    </TableCell>
                    <TableCell>{config.is_active ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : null}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleTestConnection(config.id!)} disabled={!!isTestingId}>
                        {isTestingId === config.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleEdit(config)}><Edit className="h-4 w-4" /></Button>
                      {!config.is_active && <Button variant="outline" size="sm" onClick={() => handleSetActive(config.id!)} disabled={isSubmitting}>Activar</Button>}
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(config.id!)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}