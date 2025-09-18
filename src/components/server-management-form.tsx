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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Server, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const serverFormSchema = z.object({
  ip_address: z.string().ip({ message: 'Dirección IP inválida.' }),
  ssh_username: z.string().min(1, { message: 'El usuario SSH es requerido.' }),
  ssh_password: z.string().min(1, { message: 'La contraseña SSH es requerida.' }),
  name: z.string().optional(),
});

type ServerFormValues = z.infer<typeof serverFormSchema>;

interface RegisteredServer {
  id: string;
  name?: string;
  ip_address: string;
}

const DEEPCODER_API_URL = process.env.NEXT_PUBLIC_DEEPCODER_API_URL;

export function ServerManagementForm() {
  const [isAddingServer, setIsAddingServer] = useState(false);
  const [servers, setServers] = useState<RegisteredServer[]>([]);
  const [isLoadingServers, setIsLoadingServers] = useState(true);

  const form = useForm<ServerFormValues>({
    resolver: zodResolver(serverFormSchema),
    defaultValues: {
      ip_address: '',
      ssh_username: '',
      ssh_password: '',
      name: '',
    },
  });

  const fetchServers = useCallback(async () => {
    if (!DEEPCODER_API_URL) {
      console.error('NEXT_PUBLIC_DEEPCODER_API_URL no está configurada.');
      toast.error('Error de configuración: URL del backend no definida.');
      setIsLoadingServers(false);
      return;
    }
    setIsLoadingServers(true);
    try {
      const response = await fetch(`${DEEPCODER_API_URL}/servers`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: RegisteredServer[] = await response.json();
      setServers(data);
    } catch (error: any) {
      console.error('Error fetching servers:', error);
      toast.error(`Error al cargar los servidores: ${error.message}`);
    } finally {
      setIsLoadingServers(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const onSubmit = async (values: ServerFormValues) => {
    if (!DEEPCODER_API_URL) {
      toast.error('Error de configuración: URL del backend no definida.');
      return;
    }
    setIsAddingServer(true);
    try {
      const response = await fetch(`${DEEPCODER_API_URL}/servers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      toast.success(result.message || 'Servidor añadido correctamente.');
      form.reset();
      fetchServers(); // Refresh the list of servers
    } catch (error: any) {
      console.error('Error adding server:', error);
      toast.error(`Error al añadir el servidor: ${error.message}`);
    } finally {
      setIsAddingServer(false);
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    if (!DEEPCODER_API_URL) {
      toast.error('Error de configuración: URL del backend no definida.');
      return;
    }
    // In a real scenario, you'd send a DELETE request to your backend
    // For now, we'll simulate deletion from the frontend list
    toast.info('Simulando la eliminación del servidor. Esto debería ser manejado por el backend.');
    setServers(prev => prev.filter(server => server.id !== serverId));
    toast.success('Servidor eliminado (simulado) correctamente.');
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-6 w-6" /> Añadir Nuevo Servidor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Servidor (Opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Mi Servidor de Desarrollo" {...field} disabled={isAddingServer} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ip_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dirección IP</FormLabel>
                    <FormControl>
                      <Input placeholder="192.168.1.100" {...field} disabled={isAddingServer} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ssh_username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuario SSH</FormLabel>
                    <FormControl>
                      <Input placeholder="root" {...field} disabled={isAddingServer} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ssh_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña SSH</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} disabled={isAddingServer} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isAddingServer}>
                {isAddingServer ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlusCircle className="mr-2 h-4 w-4" />
                )}
                Añadir Servidor
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-6 w-6" /> Servidores Registrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingServers ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Cargando servidores...</p>
            </div>
          ) : servers.length === 0 ? (
            <p className="text-muted-foreground">No hay servidores registrados aún.</p>
          ) : (
            <div className="space-y-4">
              {servers.map((server) => (
                <div key={server.id} className="border p-4 rounded-md bg-muted/50 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">{server.name || 'Servidor sin nombre'}</h4>
                    <p className="text-sm text-muted-foreground">IP: {server.ip_address}</p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="icon" className="h-8 w-8">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro de eliminar este servidor?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción eliminará el servidor "{server.name || server.ip_address}" de la lista.
                          (Actualmente es una eliminación simulada en el frontend).
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteServer(server.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}