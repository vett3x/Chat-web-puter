"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Loader2, Save, Database, TestTube2, PlusCircle, Trash2, Edit, CheckCircle2, Terminal, AlertCircle, RefreshCw, ScrollText } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Schema for connecting to an existing DB
const configSchema = z.object({
  id: z.string().uuid().optional(),
  nickname: z.string().min(1, 'El apodo es requerido.'),
  is_active: z.boolean().optional(),
  db_host: z.string().min(1, 'El host es requerido.'),
  db_port: z.coerce.number().int().min(1, 'El puerto es requerido.'),
  db_name: z.string().min(1, 'El nombre de la base de datos es requerido.'),
  db_user: z.string().min(1, 'El usuario es requerido.'),
  db_password: z.string().optional(),
});

// Schema for provisioning a new DB server
const provisionSchema = z.object({
  ssh_host: z.string().ip({ message: 'Debe ser una IP válida.' }),
  ssh_port: z.coerce.number().int().min(1),
  ssh_user: z.string().min(1, 'El usuario SSH es requerido.'),
  ssh_password: z.string().min(1, 'La contraseña SSH es requerida.'),
  nickname: z.string().min(1, 'El apodo para esta conexión es requerido.'),
  db_password: z.string().min(6, 'La contraseña de la BD debe tener al menos 6 caracteres.'),
});

const reprovisionSchema = z.object({
  ssh_password: z.string().min(1, 'La contraseña SSH es requerida.'),
  db_password: z.string().min(6, 'La contraseña de la BD debe tener al menos 6 caracteres.'),
});

type ConfigFormValues = z.infer<typeof configSchema>;
type ProvisionFormValues = z.infer<typeof provisionSchema>;
type ReprovisionFormValues = z.infer<typeof reprovisionSchema>;

interface DbConfig extends ConfigFormValues {
  created_at: string;
  status: 'provisioning' | 'ready' | 'failed';
  provisioning_log?: string | null;
}

export function DatabaseConfigTab() {
  const [configs, setConfigs] = useState<DbConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTestingId, setIsTestingId] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<DbConfig | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [viewingLogConfig, setViewingLogConfig] = useState<DbConfig | null>(null);
  const [reprovisioningConfig, setReprovisioningConfig] = useState<DbConfig | null>(null);

  const configForm = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: { nickname: '', is_active: false, db_host: '', db_port: 5432, db_name: 'postgres', db_user: 'postgres', db_password: '' },
  });

  const provisionForm = useForm<ProvisionFormValues>({
    resolver: zodResolver(provisionSchema),
    defaultValues: { ssh_host: '', ssh_port: 22, ssh_user: 'root', ssh_password: '', nickname: '', db_password: '' },
  });

  const reprovisionForm = useForm<ReprovisionFormValues>({
    resolver: zodResolver(reprovisionSchema),
    defaultValues: { ssh_password: '', db_password: '' },
  });

  const fetchConfigs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/database-config');
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

  const handleEdit = (config: DbConfig) => {
    setEditingConfig(config);
    configForm.reset({ ...config, db_password: '' });
  };

  const handleCancelEdit = () => {
    setEditingConfig(null);
    configForm.reset({ nickname: '', is_active: false, db_host: '', db_port: 5432, db_name: 'postgres', db_user: 'postgres', db_password: '' });
  };

  const onConfigSubmit = async (values: ConfigFormValues) => {
    if (editingConfig && !values.db_password) {
      delete values.db_password;
    } else if (!editingConfig && !values.db_password) {
      configForm.setError('db_password', { message: 'La contraseña es requerida.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const method = editingConfig ? 'PUT' : 'POST';
      const response = await fetch('/api/admin/database-config', {
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

  const onProvisionSubmit = async (values: ProvisionFormValues) => {
    setIsProvisioning(true);
    const toastId = toast.loading('Aprovisionando servidor PostgreSQL...');
    try {
      const response = await fetch('/api/admin/database-config/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message, { id: toastId });
      provisionForm.reset();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`, { id: toastId });
    } finally {
      setIsProvisioning(false);
      fetchConfigs(); // Always refresh after provisioning attempt
    }
  };

  const handleTestConnection = async (id: string) => {
    setIsTestingId(id);
    const toastId = toast.loading('Probando conexión...');
    try {
      const response = await fetch('/api/admin/database-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message, { id: toastId });
    } catch (err: any) {
      toast.error(err.message, { id: toastId, duration: 10000 });
    } finally {
      setIsTestingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/database-config?id=${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      fetchConfigs();
    } catch (err: any) {
      toast.error(`Error al eliminar: ${err.message}`);
    }
  };

  const handleSetActive = async (id: string) => {
    const configToActivate = configs.find(c => c.id === id);
    if (!configToActivate) return;
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/database-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...configToActivate, is_active: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(`'${configToActivate.nickname}' ahora es la base de datos activa.`);
      fetchConfigs();
    } catch (err: any) {
      toast.error(`Error al activar: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReprovisionSubmit = async (values: ReprovisionFormValues) => {
    if (!reprovisioningConfig) return;
    setIsProvisioning(true);
    const toastId = toast.loading('Reinstalando servidor PostgreSQL...');
    try {
      const response = await fetch(`/api/admin/database-config/${reprovisioningConfig.id}/reprovision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message, { id: toastId });
      setReprovisioningConfig(null);
      reprovisionForm.reset();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`, { id: toastId });
    } finally {
      setIsProvisioning(false);
      fetchConfigs();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Terminal className="h-6 w-6" /> Aprovisionar Nuevo Servidor PostgreSQL</CardTitle>
          <CardDescription>
            Instala y configura PostgreSQL de forma segura en un servidor Ubuntu limpio. Crea un usuario y base de datos dedicados para la aplicación.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...provisionForm}>
            <form onSubmit={provisionForm.handleSubmit(onProvisionSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={provisionForm.control} name="ssh_host" render={({ field }) => (<FormItem><FormLabel>IP del Servidor (CT)</FormLabel><FormControl><Input placeholder="10.10.10.210" {...field} disabled={isProvisioning} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={provisionForm.control} name="ssh_user" render={({ field }) => (<FormItem><FormLabel>Usuario SSH</FormLabel><FormControl><Input {...field} disabled={isProvisioning} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={provisionForm.control} name="ssh_password" render={({ field }) => (<FormItem><FormLabel>Contraseña SSH</FormLabel><FormControl><Input type="password" {...field} disabled={isProvisioning} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={provisionForm.control} name="nickname" render={({ field }) => (<FormItem><FormLabel>Apodo del Servidor de BD</FormLabel><FormControl><Input placeholder="Mi Nuevo Servidor DB" {...field} disabled={isProvisioning} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={provisionForm.control} name="db_password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña para la Base de Datos</FormLabel>
                    <FormControl><Input type="password" {...field} disabled={isProvisioning} /></FormControl>
                    <FormDescription>
                      Se creará un usuario 'app_user' y una base de datos 'app_db'. Esta contraseña se asignará tanto al superusuario 'postgres' como a 'app_user'.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <Button type="submit" disabled={isProvisioning}>
                {isProvisioning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                Aprovisionar e Instalar
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader><CardTitle>Servidores de Base de Datos Configurados</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Apodo</TableHead><TableHead>Host</TableHead><TableHead>Estado</TableHead><TableHead>Activo</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
              <TableBody>
                {configs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell className="font-medium">{config.nickname}</TableCell>
                    <TableCell>{config.db_host}:{config.db_port}</TableCell>
                    <TableCell>
                      {config.status === 'ready' && <Badge>Listo</Badge>}
                      {config.status === 'provisioning' && <Badge variant="outline" className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Aprovisionando</Badge>}
                      {config.status === 'failed' && <Badge variant="destructive" className="flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Falló</Badge>}
                    </TableCell>
                    <TableCell>{config.is_active ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : null}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {(config.status === 'provisioning' || config.status === 'failed') && (
                        <Button variant="secondary" size="sm" onClick={() => setViewingLogConfig(config)}><ScrollText className="h-4 w-4" /></Button>
                      )}
                      {config.status === 'failed' ? (
                        <Button variant="secondary" size="sm" onClick={() => setReprovisioningConfig(config)} disabled={isProvisioning}><RefreshCw className="h-4 w-4" /></Button>
                      ) : (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleTestConnection(config.id!)} disabled={!!isTestingId || config.status !== 'ready'}><TestTube2 className="h-4 w-4" /></Button>
                          <Button variant="outline" size="sm" onClick={() => handleEdit(config)} disabled={!!isSubmitting || config.status !== 'ready'}><Edit className="h-4 w-4" /></Button>
                          {!config.is_active && <Button variant="outline" size="sm" onClick={() => handleSetActive(config.id!)} disabled={!!isSubmitting || config.status !== 'ready'}>Activar</Button>}
                        </>
                      )}
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(config.id!)} disabled={!!isSubmitting}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="h-6 w-6" /> {editingConfig ? 'Editar Conexión Existente' : 'Añadir Conexión a Base de Datos Existente'}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...configForm}>
            <form onSubmit={configForm.handleSubmit(onConfigSubmit)} className="space-y-4">
              <FormField control={configForm.control} name="nickname" render={({ field }) => (<FormItem><FormLabel>Apodo</FormLabel><FormControl><Input placeholder="Servidor Principal (EU)" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={configForm.control} name="db_host" render={({ field }) => (<FormItem><FormLabel>Host / IP</FormLabel><FormControl><Input placeholder="192.168.1.10" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={configForm.control} name="db_port" render={({ field }) => (<FormItem><FormLabel>Puerto</FormLabel><FormControl><Input type="number" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={configForm.control} name="db_name" render={({ field }) => (<FormItem><FormLabel>Nombre de la Base de Datos</FormLabel><FormControl><Input {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={configForm.control} name="db_user" render={({ field }) => (<FormItem><FormLabel>Usuario Administrador</FormLabel><FormControl><Input {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={configForm.control} name="db_password" render={({ field }) => (<FormItem><FormLabel>Contraseña de Administrador</FormLabel><FormControl><Input type="password" placeholder={editingConfig ? "Dejar en blanco para no cambiar" : "••••••••"} {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={configForm.control} name="is_active" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Activar para nuevos proyectos</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting} /></FormControl></FormItem>)} />
              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingConfig ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)}
                  {editingConfig ? 'Guardar Cambios' : 'Añadir Conexión'}
                </Button>
                {editingConfig && <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={isSubmitting}>Cancelar</Button>}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Log Viewer Dialog */}
      <Dialog open={!!viewingLogConfig} onOpenChange={(open) => !open && setViewingLogConfig(null)}>
        <DialogContent className="sm:max-w-[80vw] h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Log de Aprovisionamiento: {viewingLogConfig?.nickname}</DialogTitle>
            <DialogDescription>Mostrando la salida del script de instalación.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded-md bg-[#1E1E1E]">
            <SyntaxHighlighter language="bash" style={vscDarkPlus} customStyle={{ margin: 0, height: '100%', background: 'transparent' }} codeTagProps={{ style: { fontFamily: 'var(--font-geist-mono)' } }} wrapLines={true} wrapLongLines={true}>
              {viewingLogConfig?.provisioning_log || 'No hay logs disponibles.'}
            </SyntaxHighlighter>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cerrar</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reprovision Dialog */}
      <Dialog open={!!reprovisioningConfig} onOpenChange={(open) => !open && setReprovisioningConfig(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reinstalar Servidor PostgreSQL</DialogTitle>
            <DialogDescription>
              Reinstalando en {reprovisioningConfig?.db_host}. Por favor, proporciona las credenciales necesarias.
            </DialogDescription>
          </DialogHeader>
          <Form {...reprovisionForm}>
            <form onSubmit={reprovisionForm.handleSubmit(handleReprovisionSubmit)} className="space-y-4 py-4">
              <FormField control={reprovisionForm.control} name="ssh_password" render={({ field }) => (<FormItem><FormLabel>Contraseña SSH del Servidor</FormLabel><FormControl><Input type="password" {...field} disabled={isProvisioning} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={reprovisionForm.control} name="db_password" render={({ field }) => (<FormItem><FormLabel>Nueva Contraseña para PostgreSQL</FormLabel><FormControl><Input type="password" {...field} disabled={isProvisioning} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setReprovisioningConfig(null)} disabled={isProvisioning}>Cancelar</Button>
                <Button type="submit" disabled={isProvisioning}>
                  {isProvisioning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Reinstalar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}