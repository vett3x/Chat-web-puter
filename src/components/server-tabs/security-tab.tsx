"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Loader2, Shield, PlusCircle, Trash2, RefreshCw, Search, Ban } from 'lucide-react';
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
import { useSession } from '@/components/session-context-provider';
import {
  Dialog,
  DialogContent,
  DialogDescription as DialogDescriptionComponent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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

interface SystemStatus {
  security_enabled: boolean;
  maintenance_mode_enabled: boolean;
  users_disabled: boolean;
  admins_disabled: boolean;
}

export function SecurityTab() {
  const { userRole } = useSession();
  const isSuperAdmin = userRole === 'super_admin';

  const [commands, setCommands] = useState<AllowedCommand[]>([]);
  const [isLoadingCommands, setIsLoadingCommands] = useState(true);
  const [isSubmittingCommand, setIsSubmittingCommand] = useState(false);
  const [isAddCommandDialogOpen, setIsAddCommandDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isToggling, setIsToggling] = useState<string | null>(null);

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

  const fetchStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const response = await fetch('/api/settings/security');
      if (!response.ok) throw new Error((await response.json()).message);
      setSystemStatus(await response.json());
    } catch (err: any) {
      toast.error(`Error al cargar el estado del sistema: ${err.message}`);
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    fetchCommands();
    fetchStatus();
  }, [fetchCommands, fetchStatus]);

  const onSubmit = async (values: CommandFormValues) => {
    setIsSubmittingCommand(true);
    try {
      const response = await fetch('/api/security/allowed-commands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      form.reset();
      fetchCommands();
      setIsAddCommandDialogOpen(false);
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

  const handleToggleSetting = async (setting: keyof SystemStatus, checked: boolean) => {
    setIsToggling(setting);
    try {
      const response = await fetch('/api/settings/security', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [setting]: checked }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success('Configuración actualizada.');
      fetchStatus(); // Refresh status
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsToggling(null);
    }
  };

  const filteredCommands = commands.filter(cmd =>
    cmd.command.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cmd.description && cmd.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8 h-full overflow-y-auto p-1">
      <Card className="bg-black/20 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-6 w-6" /> Controles de Seguridad Global</CardTitle>
          <CardDescription>Gestiona el estado general de la aplicación y las restricciones de acceso.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingStatus ? <Loader2 className="h-6 w-6 animate-spin" /> : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-3"><Label htmlFor="security-toggle">Seguridad de Comandos de IA</Label><Switch id="security-toggle" checked={systemStatus?.security_enabled} onCheckedChange={(c) => handleToggleSetting('security_enabled', c)} disabled={isToggling === 'security_enabled'} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><Label htmlFor="maintenance-toggle">Modo Mantenimiento</Label><Switch id="maintenance-toggle" checked={systemStatus?.maintenance_mode_enabled} onCheckedChange={(c) => handleToggleSetting('maintenance_mode_enabled', c)} disabled={isToggling === 'maintenance_mode_enabled'} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><Label htmlFor="users-disabled-toggle">Desactivar Cuentas de Usuario</Label><Switch id="users-disabled-toggle" checked={systemStatus?.users_disabled} onCheckedChange={(c) => handleToggleSetting('users_disabled', c)} disabled={isToggling === 'users_disabled'} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><Label htmlFor="admins-disabled-toggle">Desactivar Cuentas de Admin</Label><Switch id="admins-disabled-toggle" checked={systemStatus?.admins_disabled} onCheckedChange={(c) => handleToggleSetting('admins_disabled', c)} disabled={isToggling === 'admins_disabled'} /></div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-black/20 border-white/10">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2"><Ban className="h-6 w-6" /> Comandos Permitidos por la IA</CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar comando..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
              <Dialog open={isAddCommandDialogOpen} onOpenChange={setIsAddCommandDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={!isSuperAdmin}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Añadir
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Añadir Comando a la Lista Blanca</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                      <FormField control={form.control} name="command" render={({ field }) => (<FormItem><FormLabel>Comando</FormLabel><FormControl><Input placeholder="ej: npm" {...field} disabled={isSubmittingCommand} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Descripción (Opcional)</FormLabel><FormControl><Input placeholder="ej: Node Package Manager" {...field} disabled={isSubmittingCommand} /></FormControl><FormMessage /></FormItem>)} />
                      <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmittingCommand}>Cancelar</Button></DialogClose>
                        <Button type="submit" disabled={isSubmittingCommand}>
                          {isSubmittingCommand ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                          Añadir Comando
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
              <Button variant="ghost" size="icon" onClick={fetchCommands} disabled={isLoadingCommands}>
                {isLoadingCommands ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingCommands ? (
            <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader><TableRow><TableHead>Comando</TableHead><TableHead>Descripción</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredCommands.map((cmd) => (
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
              </div>
              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {filteredCommands.map((cmd) => (
                  <Card key={cmd.command}>
                    <CardContent className="p-4 flex justify-between items-start">
                      <div className="space-y-1">
                        <h4 className="font-mono font-semibold">{cmd.command}</h4>
                        <p className="text-sm text-muted-foreground">{cmd.description || 'Sin descripción.'}</p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8 flex-shrink-0" disabled={!isSuperAdmin}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>¿Estás seguro?</AlertDialogTitle><AlertDialogDescription>Eliminar "{cmd.command}" impedirá que la IA lo ejecute. Esta acción es irreversible.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(cmd.command)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}