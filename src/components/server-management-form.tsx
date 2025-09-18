"use client";

import React, { useState } from 'react';
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
import { Loader2, PlusCircle, Server } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const serverFormSchema = z.object({
  ip_address: z.string().ip({ message: 'Dirección IP inválida.' }),
  ssh_username: z.string().min(1, { message: 'El usuario SSH es requerido.' }),
  ssh_password: z.string().min(1, { message: 'La contraseña SSH es requerida.' }),
  name: z.string().optional(),
});

type ServerFormValues = z.infer<typeof serverFormSchema>;

export function ServerManagementForm() {
  const [isAddingServer, setIsAddingServer] = useState(false);
  const [servers, setServers] = useState<ServerFormValues[]>([]); // Placeholder for server list

  const form = useForm<ServerFormValues>({
    resolver: zodResolver(serverFormSchema),
    defaultValues: {
      ip_address: '',
      ssh_username: '',
      ssh_password: '',
      name: '',
    },
  });

  const onSubmit = async (values: ServerFormValues) => {
    setIsAddingServer(true);
    try {
      // In a real application, you would send these details to your separate backend
      // The backend would then establish SSH connection, verify, and store securely.
      console.log('Attempting to add server:', values);
      toast.info('Simulando la adición del servidor. Los datos se enviarán a tu backend de orquestación.');

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      setServers(prev => [...prev, values]);
      form.reset();
      toast.success('Servidor añadido (simulado) correctamente.');
    } catch (error: any) {
      console.error('Error adding server:', error.message);
      toast.error(`Error al añadir el servidor: ${error.message}`);
    } finally {
      setIsAddingServer(false);
    }
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
          {servers.length === 0 ? (
            <p className="text-muted-foreground">No hay servidores registrados aún.</p>
          ) : (
            <div className="space-y-4">
              {servers.map((server, index) => (
                <div key={index} className="border p-4 rounded-md bg-muted/50">
                  <h4 className="font-semibold">{server.name || 'Servidor sin nombre'}</h4>
                  <p className="text-sm text-muted-foreground">IP: {server.ip_address}</p>
                  <p className="text-sm text-muted-foreground">Usuario SSH: {server.ssh_username}</p>
                  {/* Do NOT display SSH password */}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}