"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Loader2, Save, Database, TestTube2, PlusCircle, Trash2, Edit, CheckCircle2, Terminal, AlertCircle, RefreshCw, ScrollText, HardDrive, Download, Play } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription as DialogDescriptionComponent, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog'; // Renamed DialogDescription to avoid conflict
import CodeEditor from '@uiw/react-textarea-code-editor';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// DB Schemas
const dbConfigSchema = z.object({
  id: z.string().uuid().optional(),
  nickname: z.string().min(1, 'El apodo es requerido.'),
  is_active: z.boolean().optional(),
  db_host: z.string().min(1, 'El host es requerido.'),
  db_port: z.coerce.number().int().min(1, 'El puerto es requerido.'),
  db_name: z.string().min(1, 'El nombre de la base de datos es requerido.'),
  db_user: z.string().min(1, 'El usuario es requerido.'),
  db_password: z.string().optional(),
});
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

// S3 Schemas
const s3ConfigSchema = z.object({
  id: z.string().uuid().optional(),
  nickname: z.string().min(1, 'El apodo es requerido.'),
  endpoint: z.string().url('Debe ser una URL válida.'),
  bucket_name: z.string().min(1, 'El nombre del bucket es requerido.'),
  region: z.string().min(1, 'La región es requerida.'),
  access_key_id: z.string().min(1, 'El Access Key ID es requerido.'),
  secret_access_key: z.string().optional(),
});

// Types
type DbConfigFormValues = z.infer<typeof dbConfigSchema>;
type ProvisionFormValues = z.infer<typeof provisionSchema>;
type ReprovisionFormValues = z.infer<typeof reprovisionSchema>;
type S3ConfigFormValues = z.infer<typeof s3ConfigSchema>;

interface DbConfig extends DbConfigFormValues {
  created_at: string;
  status: 'provisioning' | 'ready' | 'failed';
  provisioning_log?: string | null;
}
interface S3Config extends S3ConfigFormValues {
  created_at: string;
  is_active: boolean;
  status: 'unverified' | 'verified' | 'failed';
}
interface Backup {
  key: string;
  appName: string;
  size: number;
  lastModified: string;
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function DataStorageTab() {
  // DB State
  const [dbConfigs, setDbConfigs] = useState<DbConfig[]>([]);
  const [isLoadingDb, setIsLoadingDb] = useState(true);
  const [isSubmittingDb, setIsSubmittingDb] = useState(false);
  const [isTestingDbId, setIsTestingDbId] = useState<string | null>(null);
  const [editingDbConfig, setEditingDbConfig] = useState<DbConfig | null>(null);
  const [isProvisioningDb, setIsProvisioningDb] = useState(false);
  const [viewingLogConfig, setViewingLogConfig] = useState<DbConfig | null>(null);
  const [reprovisioningConfig, setReprovisioningConfig] = useState<DbConfig | null>(null);
  const [isAddDbConnectionDialogOpen, setIsAddDbConnectionDialogOpen] = useState(false);
  const [isProvisionDbDialogOpen, setIsProvisionDbDialogOpen] = useState(false);

  // S3 State
  const [s3Configs, setS3Configs] = useState<S3Config[]>([]);
  const [isLoadingS3, setIsLoadingS3] = useState(true);
  const [isSubmittingS3, setIsSubmittingS3] = useState(false);
  const [isTestingS3Id, setIsTestingS3Id] = useState<string | null>(null);
  const [editingS3Config, setEditingS3Config] = useState<S3Config | null>(null);
  const [isAddS3ConfigDialogOpen, setIsAddS3ConfigDialogOpen] = useState(false);

  // Backup State
  const [backups, setBackups] = useState<Backup[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(true);
  const [isActioningBackup, setIsActioningBackup] = useState<string | null>(null);

  // Forms
  const dbConfigForm = useForm<DbConfigFormValues>({ resolver: zodResolver(dbConfigSchema), defaultValues: { nickname: '', is_active: false, db_host: '', db_port: 5432, db_name: 'postgres', db_user: 'postgres', db_password: '' } });
  const provisionForm = useForm<ProvisionFormValues>({ resolver: zodResolver(provisionSchema), defaultValues: { ssh_host: '', ssh_port: 22, ssh_user: 'root', ssh_password: '', nickname: '', db_password: '' } });
  const reprovisionForm = useForm<ReprovisionFormValues>({ resolver: zodResolver(reprovisionSchema), defaultValues: { ssh_password: '', db_password: '' } });
  const s3ConfigForm = useForm<S3ConfigFormValues>({ resolver: zodResolver(s3ConfigSchema), defaultValues: { nickname: '', endpoint: '', bucket_name: '', region: '', access_key_id: '', secret_access_key: '' } });

  // Fetch Functions
  const fetchDbConfigs = useCallback(async () => { setIsLoadingDb(true); try { const res = await fetch('/api/admin/database-config'); if (!res.ok) throw new Error((await res.json()).message); setDbConfigs(await res.json()); } catch (e: any) { toast.error(`Error al cargar configs de BD: ${e.message}`); } finally { setIsLoadingDb(false); } }, []);
  const fetchS3Configs = useCallback(async () => { setIsLoadingS3(true); try { const res = await fetch('/api/admin/s3-configs'); if (!res.ok) throw new Error((await res.json()).message); setS3Configs(await res.json()); } catch (e: any) { toast.error(`Error al cargar configs S3: ${e.message}`); } finally { setIsLoadingS3(false); } }, []);
  const fetchBackups = useCallback(async () => { setIsLoadingBackups(true); try { const res = await fetch('/api/admin/s3-backups'); if (!res.ok) throw new Error((await res.json()).message); setBackups(await res.json()); } catch (e: any) { toast.error(`Error al cargar backups: ${e.message}`); } finally { setIsLoadingBackups(false); } }, []);

  useEffect(() => { fetchDbConfigs(); fetchS3Configs(); fetchBackups(); }, [fetchDbConfigs, fetchS3Configs, fetchBackups]);

  // DB Handlers
  const handleEditDb = (config: DbConfig) => { setEditingDbConfig(config); dbConfigForm.reset({ ...config, db_password: '' }); setIsAddDbConnectionDialogOpen(true); };
  const handleCancelEditDb = () => { setEditingDbConfig(null); dbConfigForm.reset({ nickname: '', is_active: false, db_host: '', db_port: 5432, db_name: 'postgres', db_user: 'postgres', db_password: '' }); setIsAddDbConnectionDialogOpen(false); };
  const onDbConfigSubmit = async (values: DbConfigFormValues) => { if (editingDbConfig && !values.db_password) { delete values.db_password; } else if (!editingDbConfig && !values.db_password) { dbConfigForm.setError('db_password', { message: 'La contraseña es requerida.' }); return; } setIsSubmittingDb(true); try { const method = editingDbConfig ? 'PUT' : 'POST'; const res = await fetch('/api/admin/database-config', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingDbConfig ? { ...values, id: editingDbConfig.id } : values) }); const result = await res.json(); if (!res.ok) throw new Error(result.message); toast.success(result.message); handleCancelEditDb(); fetchDbConfigs(); } catch (e: any) { toast.error(`Error al guardar: ${e.message}`); } finally { setIsSubmittingDb(false); } };
  const onProvisionSubmit = async (values: ProvisionFormValues) => { setIsProvisioningDb(true); const toastId = toast.loading('Aprovisionando servidor PostgreSQL...'); try { const res = await fetch('/api/admin/database-config/provision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }); const result = await res.json(); if (!res.ok) throw new Error(result.message); toast.success(result.message, { id: toastId }); provisionForm.reset(); setIsProvisionDbDialogOpen(false); } catch (e: any) { toast.error(`Error: ${e.message}`, { id: toastId }); } finally { setIsProvisioningDb(false); fetchDbConfigs(); } };
  const handleTestDbConnection = async (id: string) => { setIsTestingDbId(id); const toastId = toast.loading('Probando conexión...'); try { const res = await fetch('/api/admin/database-config/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); const result = await res.json(); if (!res.ok) throw new Error(result.message); toast.success(result.message, { id: toastId }); } catch (e: any) { toast.error(e.message, { id: toastId, duration: 10000 }); } finally { setIsTestingDbId(null); } };
  const handleDeleteDb = async (id: string) => { try { const res = await fetch(`/api/admin/database-config?id=${id}`, { method: 'DELETE' }); const result = await res.json(); if (!res.ok) throw new Error(result.message); toast.success(result.message); fetchDbConfigs(); } catch (e: any) { toast.error(`Error al eliminar: ${e.message}`); } };
  const handleSetDbActive = async (id: string) => { const config = dbConfigs.find(c => c.id === id); if (!config) return; setIsSubmittingDb(true); try { const res = await fetch('/api/admin/database-config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...config, is_active: true }) }); const result = await res.json(); if (!res.ok) throw new Error(result.message); toast.success(`'${config.nickname}' ahora es la base de datos activa.`); fetchDbConfigs(); } catch (e: any) { toast.error(`Error al activar: ${e.message}`); } finally { setIsSubmittingDb(false); } };
  const handleReprovisionSubmit = async (values: ReprovisionFormValues) => { if (!reprovisioningConfig) return; setIsProvisioningDb(true); const toastId = toast.loading('Reinstalando servidor PostgreSQL...'); try { const res = await fetch(`/api/admin/database-config/${reprovisioningConfig.id}/reprovision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }); const result = await res.json(); if (!res.ok) throw new Error(result.message); toast.success(result.message, { id: toastId }); setReprovisioningConfig(null); reprovisionForm.reset(); } catch (e: any) { toast.error(`Error: ${e.message}`, { id: toastId }); } finally { setIsProvisioningDb(false); fetchDbConfigs(); } };

  // S3 Handlers
  const handleEditS3 = (config: S3Config) => { setEditingS3Config(config); s3ConfigForm.reset({ ...config, secret_access_key: '' }); setIsAddS3ConfigDialogOpen(true); };
  const handleCancelEditS3 = () => { setEditingS3Config(null); s3ConfigForm.reset({ nickname: '', endpoint: '', bucket_name: '', region: '', access_key_id: '', secret_access_key: '' }); setIsAddS3ConfigDialogOpen(false); };
  const onS3ConfigSubmit = async (values: S3ConfigFormValues) => { if (editingS3Config && !values.secret_access_key) { delete values.secret_access_key; } else if (!editingS3Config && !values.secret_access_key) { s3ConfigForm.setError('secret_access_key', { message: 'La clave secreta es requerida.' }); return; } setIsSubmittingS3(true); try { const method = editingS3Config ? 'PUT' : 'POST'; const res = await fetch('/api/admin/s3-configs', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingS3Config ? { ...values, id: editingS3Config.id } : values) }); const result = await res.json(); if (!res.ok) throw new Error(result.message); toast.success(result.message); handleCancelEditS3(); fetchS3Configs(); } catch (e: any) { toast.error(`Error al guardar: ${e.message}`); } finally { setIsSubmittingS3(false); } };
  const handleTestS3Connection = async (id: string) => { setIsTestingS3Id(id); const toastId = toast.loading('Probando conexión S3...'); try { const res = await fetch('/api/admin/s3-configs/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); const result = await res.json(); if (!res.ok) throw new Error(result.message); toast.success(result.message, { id: toastId }); fetchS3Configs(); } catch (e: any) { toast.error(e.message, { id: toastId, duration: 10000 }); } finally { setIsTestingS3Id(null); } };
  const handleDeleteS3 = async (id: string) => { try { const res = await fetch(`/api/admin/s3-configs?id=${id}`, { method: 'DELETE' }); const result = await res.json(); if (!res.ok) throw new Error(result.message); toast.success(result.message); fetchS3Configs(); } catch (e: any) { toast.error(`Error al eliminar: ${e.message}`); } };
  const handleSetS3Active = async (id: string) => { setIsSubmittingS3(true); try { const res = await fetch('/api/admin/s3-configs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_active: true }) }); const result = await res.json(); if (!res.ok) throw new Error(result.message); toast.success(`Configuración S3 activada.`); fetchS3Configs(); } catch (e: any) { toast.error(`Error al activar: ${e.message}`); } finally { setIsSubmittingS3(false); } };

  // Backup Handlers
  const handleRunBackups = async () => { setIsActioningBackup('run'); toast.info('Iniciando proceso de backup en segundo plano...'); try { const res = await fetch('/api/admin/s3-backups', { method: 'POST' }); const result = await res.json(); if (!res.ok) throw new Error(result.message); toast.success(result.message); setTimeout(fetchBackups, 10000); } catch (e: any) { toast.error(`Error al iniciar backups: ${e.message}`); } finally { setIsActioningBackup(null); } };
  const handleDeleteBackup = async (key: string) => { setIsActioningBackup(key); try { const res = await fetch(`/api/admin/s3-backups?key=${encodeURIComponent(key)}`, { method: 'DELETE' }); if (!res.ok) throw new Error((await res.json()).message); toast.success('Backup eliminado.'); fetchBackups(); } catch (e: any) { toast.error(`Error al eliminar: ${e.message}`); } finally { setIsActioningBackup(null); } };

  return (
    <Card className="bg-black/20 border-white/10">
      <CardHeader>
        <CardTitle>Gestión de Datos y Almacenamiento</CardTitle>
        <CardDescription>Configura tus servidores de bases de datos, almacenamiento S3 y gestiona los backups.</CardDescription>
        <div className="flex flex-wrap gap-2 pt-4">
          <Dialog open={isProvisionDbDialogOpen} onOpenChange={setIsProvisionDbDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Terminal className="mr-2 h-4 w-4" /> Aprovisionar Servidor DB</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[600px]"><DialogHeader><DialogTitle className="flex items-center gap-2"><Terminal className="h-6 w-6" /> Aprovisionar Nuevo Servidor PostgreSQL</DialogTitle><DialogDescriptionComponent>Instala y configura PostgreSQL de forma segura en un servidor Ubuntu limpio.</DialogDescriptionComponent></DialogHeader><Form {...provisionForm}><form onSubmit={provisionForm.handleSubmit(onProvisionSubmit)} className="space-y-4 py-4"><FormField control={provisionForm.control} name="ssh_host" render={({ field }) => (<FormItem><FormLabel>IP del Servidor (CT)</FormLabel><FormControl><Input placeholder="10.10.10.210" {...field} disabled={isProvisioningDb} /></FormControl><FormMessage /></FormItem>)} /><FormField control={provisionForm.control} name="ssh_user" render={({ field }) => (<FormItem><FormLabel>Usuario SSH</FormLabel><FormControl><Input {...field} disabled={isProvisioningDb} /></FormControl><FormMessage /></FormItem>)} /><FormField control={provisionForm.control} name="ssh_password" render={({ field }) => (<FormItem><FormLabel>Contraseña SSH</FormLabel><FormControl><Input type="password" {...field} disabled={isProvisioningDb} /></FormControl><FormMessage /></FormItem>)} /><FormField control={provisionForm.control} name="nickname" render={({ field }) => (<FormItem><FormLabel>Apodo del Servidor de BD</FormLabel><FormControl><Input placeholder="Mi Nuevo Servidor DB" {...field} disabled={isProvisioningDb} /></FormControl><FormMessage /></FormItem>)} /><FormField control={provisionForm.control} name="db_password" render={({ field }) => (<FormItem><FormLabel>Contraseña para la Base de Datos</FormLabel><FormControl><Input type="password" {...field} disabled={isProvisioningDb} /></FormControl><FormDescription>Se creará un usuario 'app_user' y una base de datos 'app_db'. Esta contraseña se asignará tanto al superusuario 'postgres' como a 'app_user'.</FormDescription><FormMessage /></FormItem>)} /><DialogFooter><DialogClose asChild><Button type="button" variant="outline" disabled={isProvisioningDb}>Cancelar</Button></DialogClose><Button type="submit" disabled={isProvisioningDb}>{isProvisioningDb ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />} Aprovisionar e Instalar</Button></DialogFooter></form></Form></DialogContent>
          </Dialog>
          <Dialog open={isAddDbConnectionDialogOpen} onOpenChange={setIsAddDbConnectionDialogOpen}>
            <DialogTrigger asChild><Button size="sm" variant="outline" onClick={() => { setEditingDbConfig(null); dbConfigForm.reset({ nickname: '', is_active: false, db_host: '', db_port: 5432, db_name: 'postgres', db_user: 'postgres', db_password: '' }); setIsAddDbConnectionDialogOpen(true); }}><PlusCircle className="mr-2 h-4 w-4" /> Añadir Conexión DB</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[525px]"><DialogHeader><DialogTitle className="flex items-center gap-2"><Database className="h-6 w-6" /> {editingDbConfig ? 'Editar Conexión Existente' : 'Añadir Conexión a Base de Datos Existente'}</DialogTitle></DialogHeader><Form {...dbConfigForm}><form onSubmit={dbConfigForm.handleSubmit(onDbConfigSubmit)} className="space-y-4 py-4"><FormField control={dbConfigForm.control} name="nickname" render={({ field }) => (<FormItem><FormLabel>Apodo</FormLabel><FormControl><Input placeholder="Servidor Principal (EU)" {...field} disabled={isSubmittingDb} /></FormControl><FormMessage /></FormItem>)} /><FormField control={dbConfigForm.control} name="db_host" render={({ field }) => (<FormItem><FormLabel>Host / IP</FormLabel><FormControl><Input placeholder="192.168.1.10" {...field} disabled={isSubmittingDb} /></FormControl><FormMessage /></FormItem>)} /><FormField control={dbConfigForm.control} name="db_port" render={({ field }) => (<FormItem><FormLabel>Puerto</FormLabel><FormControl><Input type="number" {...field} disabled={isSubmittingDb} /></FormControl><FormMessage /></FormItem>)} /><FormField control={dbConfigForm.control} name="db_name" render={({ field }) => (<FormItem><FormLabel>Nombre de la Base de Datos</FormLabel><FormControl><Input {...field} disabled={isSubmittingDb} /></FormControl><FormMessage /></FormItem>)} /><FormField control={dbConfigForm.control} name="db_user" render={({ field }) => (<FormItem><FormLabel>Usuario Administrador</FormLabel><FormControl><Input {...field} disabled={isSubmittingDb} /></FormControl><FormMessage /></FormItem>)} /><FormField control={dbConfigForm.control} name="db_password" render={({ field }) => (<FormItem><FormLabel>Contraseña de Administrador</FormLabel><FormControl><Input type="password" placeholder={editingDbConfig ? "Dejar en blanco para no cambiar" : "••••••••"} {...field} disabled={isSubmittingDb} /></FormControl><FormMessage /></FormItem>)} /><FormField control={dbConfigForm.control} name="is_active" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Activar para nuevos proyectos</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmittingDb} /></FormControl></FormItem>)} /><DialogFooter><Button type="button" variant="outline" onClick={handleCancelEditDb} disabled={isSubmittingDb}>Cancelar</Button><Button type="submit" disabled={isSubmittingDb}>{isSubmittingDb ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingDbConfig ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)} {editingDbConfig ? 'Guardar Cambios' : 'Añadir Conexión'}</Button></DialogFooter></form></Form></DialogContent>
          </Dialog>
          <Dialog open={isAddS3ConfigDialogOpen} onOpenChange={setIsAddS3ConfigDialogOpen}>
            <DialogTrigger asChild><Button size="sm" variant="outline" onClick={handleCancelEditS3}><PlusCircle className="mr-2 h-4 w-4" /> Añadir Configuración S3</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[600px]"><DialogHeader><DialogTitle>{editingS3Config ? 'Editar' : 'Añadir'} Configuración S3</DialogTitle><DialogDescriptionComponent>{editingS3Config ? 'Actualiza los detalles de tu configuración S3.' : 'Añade una nueva configuración de almacenamiento S3.'}</DialogDescriptionComponent></DialogHeader><Form {...s3ConfigForm}><form onSubmit={s3ConfigForm.handleSubmit(onS3ConfigSubmit)} className="space-y-4 py-4"><FormField control={s3ConfigForm.control} name="nickname" render={({ field }) => (<FormItem><FormLabel>Apodo</FormLabel><FormControl><Input placeholder="Mi Bucket de Backups" {...field} disabled={isSubmittingS3} /></FormControl></FormItem>)} /><FormField control={s3ConfigForm.control} name="endpoint" render={({ field }) => (<FormItem><FormLabel>Endpoint URL</FormLabel><FormControl><Input placeholder="https://s3.us-east-1.amazonaws.com" {...field} disabled={isSubmittingS3} /></FormControl></FormItem>)} /><FormField control={s3ConfigForm.control} name="bucket_name" render={({ field }) => (<FormItem><FormLabel>Nombre del Bucket</FormLabel><FormControl><Input placeholder="mi-bucket-unico" {...field} disabled={isSubmittingS3} /></FormControl></FormItem>)} /><FormField control={s3ConfigForm.control} name="region" render={({ field }) => (<FormItem><FormLabel>Región</FormLabel><FormControl><Input placeholder="us-east-1" {...field} disabled={isSubmittingS3} /></FormControl></FormItem>)} /><FormField control={s3ConfigForm.control} name="access_key_id" render={({ field }) => (<FormItem><FormLabel>Access Key ID</FormLabel><FormControl><Input {...field} disabled={isSubmittingS3} /></FormControl></FormItem>)} /><FormField control={s3ConfigForm.control} name="secret_access_key" render={({ field }) => (<FormItem><FormLabel>Secret Access Key</FormLabel><FormControl><Input type="password" placeholder={editingS3Config ? "Dejar en blanco para no cambiar" : "••••••••"} {...field} disabled={isSubmittingS3} /></FormControl></FormItem>)} /><DialogFooter><Button type="button" variant="outline" onClick={handleCancelEditS3} disabled={isSubmittingS3}>Cancelar</Button><Button type="submit" disabled={isSubmittingS3}>{isSubmittingS3 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} {editingS3Config ? 'Guardar Cambios' : 'Añadir Configuración'}</Button></DialogFooter></form></Form></DialogContent>
          </Dialog>
          <Button size="sm" onClick={handleRunBackups} disabled={!!isActioningBackup}>{isActioningBackup === 'run' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />} Ejecutar Backups</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="database" className="w-full">
          <TabsList className="h-auto flex-col sm:h-10 sm:flex-row">
            <TabsTrigger value="database" className="w-full justify-start sm:w-auto sm:justify-center">Bases de Datos</TabsTrigger>
            <TabsTrigger value="s3-storage" className="w-full justify-start sm:w-auto sm:justify-center">Almacenamiento S3</TabsTrigger>
            <TabsTrigger value="s3-backups" className="w-full justify-start sm:w-auto sm:justify-center">Backups</TabsTrigger>
          </TabsList>
          <TabsContent value="database" className="mt-4">
            {isLoadingDb ? <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
              <Table>
                <TableHeader><TableRow><TableHead>Apodo</TableHead><TableHead>Host</TableHead><TableHead>Estado</TableHead><TableHead>Activo</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                <TableBody>{dbConfigs.map((config) => (<TableRow key={config.id}><TableCell className="font-medium">{config.nickname}</TableCell><TableCell>{config.db_host}:{config.db_port}</TableCell><TableCell>{config.status === 'ready' && <Badge>Listo</Badge>}{config.status === 'provisioning' && <Badge variant="outline" className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Aprovisionando</Badge>}{config.status === 'failed' && <Badge variant="destructive" className="flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Falló</Badge>}</TableCell><TableCell>{config.is_active ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : null}</TableCell><TableCell className="text-right space-x-2">{(config.status === 'provisioning' || config.status === 'failed') && (<Button variant="secondary" size="sm" onClick={() => setViewingLogConfig(config)}><ScrollText className="h-4 w-4" /></Button>)}{config.status === 'failed' ? (<Button variant="secondary" size="sm" onClick={() => setReprovisioningConfig(config)} disabled={isProvisioningDb}><RefreshCw className="h-4 w-4" /></Button>) : (<><Button variant="outline" size="sm" onClick={() => handleTestDbConnection(config.id!)} disabled={!!isTestingDbId || config.status !== 'ready'}><TestTube2 className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => handleEditDb(config)} disabled={!!isSubmittingDb || config.status !== 'ready'}><Edit className="h-4 w-4" /></Button>{!config.is_active && <Button variant="outline" size="sm" onClick={() => handleSetDbActive(config.id!)} disabled={!!isSubmittingDb || config.status !== 'ready'}>Activar</Button>}</>)}<Button variant="destructive" size="sm" onClick={() => handleDeleteDb(config.id!)} disabled={!!isSubmittingDb}><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>))}</TableBody>
              </Table>
            )}
          </TabsContent>
          <TabsContent value="s3-storage" className="mt-4">
            {isLoadingS3 ? <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
              <Table>
                <TableHeader><TableRow><TableHead>Apodo</TableHead><TableHead>Bucket</TableHead><TableHead>Estado</TableHead><TableHead>Activo</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                <TableBody>{s3Configs.map((config) => (<TableRow key={config.id}><TableCell className="font-medium">{config.nickname}</TableCell><TableCell>{config.bucket_name}</TableCell><TableCell>{config.status === 'verified' && <Badge><CheckCircle2 className="h-3 w-3 mr-1" /> Verificado</Badge>}{config.status === 'unverified' && <Badge variant="secondary">Sin verificar</Badge>}{config.status === 'failed' && <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Falló</Badge>}</TableCell><TableCell>{config.is_active ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : null}</TableCell><TableCell className="text-right space-x-2"><Button variant="outline" size="sm" onClick={() => handleTestS3Connection(config.id!)} disabled={!!isTestingS3Id}>{isTestingS3Id === config.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}</Button><Button variant="outline" size="sm" onClick={() => handleEditS3(config)}><Edit className="h-4 w-4" /></Button>{!config.is_active && <Button variant="outline" size="sm" onClick={() => handleSetS3Active(config.id!)} disabled={isSubmittingS3}>Activar</Button>}<Button variant="destructive" size="sm" onClick={() => handleDeleteS3(config.id!)}><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>))}</TableBody>
              </Table>
            )}
          </TabsContent>
          <TabsContent value="s3-backups" className="mt-4">
            {isLoadingBackups ? <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
              <Table>
                <TableHeader><TableRow><TableHead>Proyecto</TableHead><TableHead>Fecha del Backup</TableHead><TableHead>Tamaño</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                <TableBody>{backups.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No hay backups en el almacenamiento S3.</TableCell></TableRow> : backups.map((backup) => (<TableRow key={backup.key}><TableCell className="font-medium">{backup.appName}</TableCell><TableCell>{format(new Date(backup.lastModified), 'dd/MM/yyyy HH:mm', { locale: es })}</TableCell><TableCell>{formatBytes(backup.size)}</TableCell><TableCell className="text-right space-x-2"><Button variant="outline" size="sm" disabled={true}><Download className="h-4 w-4" /></Button><AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="sm" disabled={isActioningBackup === backup.key}>{isActioningBackup === backup.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Eliminar este backup?</AlertDialogTitle><AlertDialogDescription>Esta acción es irreversible.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteBackup(backup.key)} className="bg-destructive">Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></TableCell></TableRow>))}</TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      {/* Dialogs for DB */}
      <Dialog open={!!viewingLogConfig} onOpenChange={(open) => !open && setViewingLogConfig(null)}>...</Dialog>
      <Dialog open={!!reprovisioningConfig} onOpenChange={(open) => !open && setReprovisioningConfig(null)}>...</Dialog>
    </Card>
  );
}