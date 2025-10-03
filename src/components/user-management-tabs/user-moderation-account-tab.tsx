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
import { Loader2, Save, KeyRound, ShieldCheck, HardDrive, History, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { PERMISSION_KEYS, UserPermissions } from '@/lib/constants';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Progress } from '@/components/ui/progress';

// Schemas
const emailSchema = z.object({ email: z.string().email('Correo electrónico inválido.') });
const passwordSchema = z.object({ password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.') });
const quotasSchema = z.object({
  max_servers: z.coerce.number().int().min(0),
  max_containers: z.coerce.number().int().min(0),
  max_tunnels: z.coerce.number().int().min(0),
  cpu_limit: z.coerce.number().min(0.1).max(16),
  memory_limit_mb: z.coerce.number().int().min(128),
  storage_limit_mb: z.coerce.number().int().min(0),
});

// Types
type UserRole = 'user' | 'admin' | 'super_admin';
type UserStatus = 'active' | 'banned' | 'kicked';
interface ModerationEvent { id: string; created_at: string; action: string; reason: string; moderator_name: string; }

// Main Component Props
interface UserModerationAccountTabProps {
  user: { id: string; email: string; first_name: string | null; last_name: string | null; role: UserRole; status: UserStatus; };
  currentUserRole: UserRole | null;
  onAccountUpdated: () => void;
}

// --- Sub-components for each section ---

function UserStorageUsage({ userId }: { userId: string }) {
  const [usage, setUsage] = useState<{ usage_bytes: number; limit_mb: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}/storage`);
      if (!response.ok) throw new Error('No se pudo cargar el uso de almacenamiento');
      const data = await response.json();
      setUsage(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  if (isLoading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando uso de almacenamiento...</div>;
  }

  if (!usage) {
    return <div className="text-sm text-destructive">No se pudo cargar el uso de almacenamiento.</div>;
  }

  const usageMb = usage.usage_bytes / (1024 * 1024);
  const percentage = usage.limit_mb > 0 ? (usageMb / usage.limit_mb) * 100 : 0;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm font-medium">
        <span>Uso de Almacenamiento</span>
        <span>{formatBytes(usage.usage_bytes)} / {usage.limit_mb} MB</span>
      </div>
      <Progress value={percentage} />
    </div>
  );
}

function UserAccountSection({ userId, userEmail, currentUserRole, targetUserRole, onAccountUpdated }: any) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const emailForm = useForm({ resolver: zodResolver(emailSchema), defaultValues: { email: userEmail } });
  const passwordForm = useForm({ resolver: zodResolver(passwordSchema), defaultValues: { password: '' } });

  const canEdit = currentUserRole === 'super_admin' && targetUserRole !== 'super_admin';

  const handleSubmit = async (type: 'email' | 'password', data: any) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/users/${userId}/account`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...data }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      onAccountUpdated();
      if (type === 'password') passwordForm.reset();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Cuenta</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Form {...emailForm}>
          <form onSubmit={emailForm.handleSubmit((data) => handleSubmit('email', data))} className="flex items-end gap-2">
            <FormField control={emailForm.control} name="email" render={({ field }) => (<FormItem className="flex-1"><FormLabel>Correo Electrónico</FormLabel><FormControl><Input {...field} disabled={!canEdit || isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
            <Button type="submit" disabled={!canEdit || isSubmitting}>{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}</Button>
          </form>
        </Form>
        <Form {...passwordForm}>
          <form onSubmit={passwordForm.handleSubmit((data) => handleSubmit('password', data))} className="flex items-end gap-2">
            <FormField control={passwordForm.control} name="password" render={({ field }) => (<FormItem className="flex-1"><FormLabel>Nueva Contraseña</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} disabled={!canEdit || isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
            <Button type="submit" disabled={!canEdit || isSubmitting}>{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function UserPermissionsSection({ userId, targetUserRole, currentUserRole, onPermissionsUpdated }: any) {
  const [permissions, setPermissions] = useState<UserPermissions>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const canEdit = currentUserRole === 'super_admin' && targetUserRole !== 'super_admin';

  useEffect(() => {
    const fetchPermissions = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/users/${userId}/permissions`);
        if (!response.ok) throw new Error('Error al cargar permisos.');
        const data = await response.json();
        setPermissions(data.permissions || {});
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPermissions();
  }, [userId]);

  const handlePermissionChange = (key: string, value: boolean) => {
    setPermissions(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/users/${userId}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      onPermissionsUpdated();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Permisos</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <div className="space-y-4">
            {Object.entries(PERMISSION_KEYS).map(([key, value]) => (
              <div key={value} className="flex items-center justify-between">
                <Label htmlFor={value} className="capitalize">{value.replace(/_/g, ' ')}</Label>
                <Switch id={value} checked={permissions[value] || false} onCheckedChange={(checked) => handlePermissionChange(value, checked)} disabled={!canEdit || isSaving} />
              </div>
            ))}
            <Button onClick={handleSaveChanges} disabled={!canEdit || isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Guardar Permisos
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UserQuotasSection({ userId, userName, currentUserRole, targetUserRole, onQuotasUpdated }: any) {
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm({ resolver: zodResolver(quotasSchema) });

  const canEdit = currentUserRole === 'super_admin' && targetUserRole !== 'super_admin';

  useEffect(() => {
    const fetchQuotas = async () => {
      try {
        const response = await fetch(`/api/users/${userId}/quotas`);
        if (!response.ok) throw new Error('Error al cargar cuotas.');
        const data = await response.json();
        form.reset(data);
      } catch (err: any) {
        toast.error(err.message);
      }
    };
    fetchQuotas();
  }, [userId, form]);

  const onSubmit = async (values: z.infer<typeof quotasSchema>) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/users/${userId}/quotas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      onQuotasUpdated();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" /> Cuotas de Recursos</CardTitle></CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="max_servers" render={({ field }) => (<FormItem><FormLabel>Max Servidores</FormLabel><FormControl><Input type="number" {...field} disabled={!canEdit || isSaving} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="max_containers" render={({ field }) => (<FormItem><FormLabel>Max Contenedores</FormLabel><FormControl><Input type="number" {...field} disabled={!canEdit || isSaving} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="max_tunnels" render={({ field }) => (<FormItem><FormLabel>Max Túneles</FormLabel><FormControl><Input type="number" {...field} disabled={!canEdit || isSaving} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="cpu_limit" render={({ field }) => (<FormItem><FormLabel>Límite de CPU (cores)</FormLabel><FormControl><Input type="number" step="0.1" {...field} disabled={!canEdit || isSaving} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="memory_limit_mb" render={({ field }) => (<FormItem><FormLabel>Límite de Memoria (MB)</FormLabel><FormControl><Input type="number" {...field} disabled={!canEdit || isSaving} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="storage_limit_mb" render={({ field }) => (<FormItem><FormLabel>Límite de Almacenamiento (MB)</FormLabel><FormControl><Input type="number" {...field} disabled={!canEdit || isSaving} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <Button type="submit" disabled={!canEdit || isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Guardar Cuotas
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function UserModerationHistorySection({ userId, currentUserRole }: any) {
  const [history, setHistory] = useState<ModerationEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}/moderation-history`);
      if (!response.ok) throw new Error('Error al cargar el historial.');
      setHistory(await response.json());
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleClearHistory = async () => {
    try {
      const response = await fetch(`/api/users/${userId}/moderation-history`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Error al limpiar el historial.');
      toast.success('Historial de moderación limpiado.');
      fetchHistory();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Historial de Moderación</CardTitle>
        {currentUserRole === 'super_admin' && (
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="destructive" size="sm" disabled={history.length === 0}><Trash2 className="mr-2 h-4 w-4" /> Limpiar</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>¿Limpiar historial?</AlertDialogTitle><AlertDialogDescription>Esta acción eliminará permanentemente todo el historial de moderación para este usuario.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleClearHistory} className="bg-destructive">Limpiar</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : history.length === 0 ? <p className="text-sm text-muted-foreground">No hay acciones de moderación registradas.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Acción</TableHead><TableHead>Moderador</TableHead><TableHead>Razón</TableHead></TableRow></TableHeader>
            <TableBody>
              {history.map(event => (
                <TableRow key={event.id}>
                  <TableCell className="text-xs">{format(new Date(event.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</TableCell>
                  <TableCell className="capitalize">{event.action}</TableCell>
                  <TableCell>{event.moderator_name}</TableCell>
                  <TableCell>{event.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// --- Main Consolidated Component ---

export function UserModerationAccountTab({ user, currentUserRole, onAccountUpdated }: UserModerationAccountTabProps) {
  const userName = user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.email;

  return (
    <ScrollArea className="h-full w-full p-1">
      <div className="space-y-8">
        <UserAccountSection
          userId={user.id}
          userEmail={user.email}
          currentUserRole={currentUserRole}
          targetUserRole={user.role}
          onAccountUpdated={onAccountUpdated}
        />
        <Separator />
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" /> Almacenamiento</CardTitle></CardHeader>
          <CardContent>
            <UserStorageUsage userId={user.id} />
          </CardContent>
        </Card>
        <Separator />
        <UserQuotasSection
          userId={user.id}
          userName={userName}
          currentUserRole={currentUserRole}
          targetUserRole={user.role}
          onQuotasUpdated={onAccountUpdated}
        />
        <Separator />
        <UserPermissionsSection
          userId={user.id}
          targetUserRole={user.role}
          currentUserRole={currentUserRole}
          onPermissionsUpdated={onAccountUpdated}
        />
        <Separator />
        <UserModerationHistorySection
          userId={user.id}
          currentUserRole={currentUserRole}
        />
      </div>
    </ScrollArea>
  );
}