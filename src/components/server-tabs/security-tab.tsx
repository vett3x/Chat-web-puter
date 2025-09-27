"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Loader2, Shield, PlusCircle, Trash2, RefreshCw, Users, UserCog } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useSession } from '@/components/session-context-provider';

interface AllowedCommand {
  command: string;
  description: string | null;
  created_at: string;
}

const commandSchema = z.object({
  command: z.string().min(1, { message: 'El comando es requerido.' }).regex(/^[a-z0-9-]+$/, { message: 'Solo minúsculas, números y guiones.' }),
  description: z.string().optional(),
});

type CommandFormValues = z.infer<typeof commandSchema>;

export function SecurityTab() {
  const { userRole } = useSession();
  const isSuperAdmin = userRole === 'super_admin';

  const [commands, setCommands] = useState<AllowedCommand[]>([]);
  const [isLoadingCommands, setIsLoadingCommands] = useState(true);
  const [isSubmittingCommand, setIsSubmittingCommand] = useState(false);

  const [securityEnabled, setSecurityEnabled] = useState(true);
  const [maintenanceModeEnabled, setMaintenanceModeEnabled] = useState(false);
  const [usersDisabled, setUsersDisabled] = useState(false); // NEW
  const [adminsDisabled, setAdminsDisabled] = useState(false); // NEW
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isTogglingSecurity, setIsTogglingSecurity] = useState(false);
  const [isTogglingMaintenance, setIsTogglingMaintenance] = useState(false);
  const [isTogglingUsers, setIsTogglingUsers] = useState(false); // NEW
  const [isTogglingAdmins, setIsTogglingAdmins] = useState(false); // NEW

  const form = useForm<CommandFormValues>({
    resolver: zodResolver(commandSchema),
    defaultValues: { command: '', description: '' },
  });

  const fetchCommands = useCallback(async () => {
    setIsLoadingCommands(true);
    try {
      const response = await fetch('/api/security/allowed-commands');
      if (!response.ok) throw new Error((await response.json()).message || 'Error al cargar los comandos.');
      setCommands(await response.json());
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoadingCommands(false);
    }
  }, []);

  const fetchGlobalSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    try {
      const response = await fetch('/api/settings/security');
      if (!response.ok) throw new Error((await response.json()).message || 'Error al cargar la configuración.');
      const data = await response.json();
      setSecurityEnabled(data.security_enabled);
      setMaintenanceModeEnabled(data.maintenance_mode_enabled);
      setUsersDisabled(data.users_disabled); // NEW
      setAdminsDisabled(data.admins_disabled); // NEW
    } catch (err: any) {
      if (isSuperAdmin) toast.error(err.message);
    } finally {
      setIsLoadingSettings(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchGlobalSettings();
    }
    fetchCommands();
  }, [fetchCommands, fetchGlobalSettings, isSuperAdmin]);

  const onSubmit = async (values: CommandFormValues) => {
    setIsSubmittingCommand(true);
    try {
      const response = await fetch('/api/security/allowed-commands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      form.reset();
      fetchCommands();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmittingCommand(false);
    }
  };

  const handleDelete = async (command: string) => {
    try {
      const response = await fetch(`/api/security/allowed-commands?command=${command}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      fetchCommands();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleSetting = async (
    setting: 'security_enabled' | 'maintenance_mode_enabled' | 'users_disabled' | 'admins_disabled',
    checked: boolean,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>,
    setValue: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings/security', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [setting]: checked }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setValue(result[setting]);
      toast.success(result.message || 'Configuración actualizada.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 h-full overflow-y-auto p-1">
      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="h-6 w-6" /> Control del Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingSettings ? (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando configuración...</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <Label htmlFor="security-toggle" className="text-base">Activar Sistema de Seguridad de Comandos</Label>
                    <p className="text-sm text-muted-foreground">Cuando está desactivado, la IA puede ejecutar cualquier comando. Úsalo con precaución.</p>
                  </div>
                  <Switch id="security-toggle" checked={securityEnabled} onCheckedChange={(c) => handleToggleSetting('security_enabled', c, setIsTogglingSecurity, setSecurityEnabled)} disabled={isTogglingSecurity} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <Label htmlFor="maintenance-toggle" className="text-base">Activar Modo Mantenimiento</Label>
                    <p className="text-sm text-muted-foreground">Expulsa a todos (excepto Super Admins) y muestra una página de mantenimiento.</p>
                  </div>
                  <Switch id="maintenance-toggle" checked={maintenanceModeEnabled} onCheckedChange={(c) => handleToggleSetting('maintenance_mode_enabled', c, setIsTogglingMaintenance, setMaintenanceModeEnabled)} disabled={isTogglingMaintenance} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <Label htmlFor="users-disabled-toggle" className="text-base">Desactivar Cuentas de Usuario</Label>
                    <p className="text-sm text-muted-foreground">Expulsa a todos los usuarios con rol 'user' y les impide iniciar sesión.</p>
                  </div>
                  <Switch id="users-disabled-toggle" checked={usersDisabled} onCheckedChange={(c) => handleToggleSetting('users_disabled', c, setIsTogglingUsers, setUsersDisabled)} disabled={isTogglingUsers} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <Label htmlFor="admins-disabled-toggle" className="text-base">Desactivar Cuentas de Admin</Label>
                    <p className="text-sm text-muted-foreground">Expulsa a todos los usuarios con rol 'admin' y les impide iniciar sesión.</p>
                  </div>
                  <Switch id="admins-disabled-toggle" checked={adminsDisabled} onCheckedChange={(c) => handleToggleSetting('admins_disabled', c, setIsTogglingAdmins, setAdminsDisabled)} disabled={isTogglingAdmins} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PlusCircle className="h-6 w-6" /> Añadir Comando a la Lista Blanca</CardTitle>
        </CardHeader>
        <CardContent>
          {!isSuperAdmin ? (
            <p className="text-muted-foreground">Solo los Super Admins pueden añadir comandos a la lista blanca.</p>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="command" render={({ field }) => (<FormItem><FormLabel>Comando</FormLabel><FormControl><Input placeholder="ej: npm" {...field} disabled={isSubmittingCommand} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Descripción (Opcional)</FormLabel><FormControl><Input placeholder="ej: Node Package Manager" {...field} disabled={isSubmittingCommand} /></FormControl><FormMessage /></FormItem>)} />
                <Button type="submit" disabled={isSubmittingCommand}>{isSubmittingCommand ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />} Añadir Comando</Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Shield className="h-6 w-6" /> Comandos Permitidos</CardTitle>
          <Button variant="ghost" size="icon" onClick={fetchCommands} disabled={isLoadingCommands}>{isLoadingCommands ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>
        </CardHeader>
        <CardContent>
          {isLoadingCommands ? (
            <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Comando</TableHead><TableHead>Descripción</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
              <TableBody>
                {commands.map((cmd) => (
                  <TableRow key={cmd.command}>
                    <TableCell className="font-mono">{cmd.command}</TableCell>
                    <TableCell>{cmd.description || 'N/A'}</TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8" disabled={!isSuperAdmin}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>¿Estás seguro?</AlertDialogTitle><AlertDialogDescription>Eliminar "{cmd.command}" impedirá que la IA lo ejecute. Esta acción es irreversible.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(cmd.command)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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