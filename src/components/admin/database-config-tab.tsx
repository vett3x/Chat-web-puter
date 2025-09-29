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
import { Loader2, Save, Database } from 'lucide-react';

const configSchema = z.object({
  db_host: z.string().min(1, 'El host es requerido.'),
  db_port: z.coerce.number().int().min(1, 'El puerto es requerido.'),
  db_name: z.string().min(1, 'El nombre de la base de datos es requerido.'),
  db_user: z.string().min(1, 'El usuario es requerido.'),
  db_password: z.string().min(1, 'La contraseña es requerida.'),
});

type ConfigFormValues = z.infer<typeof configSchema>;

export function DatabaseConfigTab() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      db_host: '',
      db_port: 5432,
      db_name: 'postgres',
      db_user: 'postgres',
      db_password: '',
    },
  });

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/database-config');
      if (!response.ok) throw new Error((await response.json()).message);
      const data = await response.json();
      if (data) {
        form.reset({
          db_host: data.db_host || '',
          db_port: data.db_port || 5432,
          db_name: data.db_name || 'postgres',
          db_user: data.db_user || 'postgres',
          db_password: '', // Always leave password blank for security
        });
      }
    } catch (err: any) {
      toast.error(`Error al cargar la configuración: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [form]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const onSubmit = async (values: ConfigFormValues) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/database-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      form.setValue('db_password', ''); // Clear password field after saving
    } catch (err: any) {
      toast.error(`Error al guardar la configuración: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Database className="h-6 w-6" /> Configuración de Base de Datos Externa</CardTitle>
        <CardDescription>
          Introduce las credenciales de administrador para tu servidor PostgreSQL autoalojado.
          Estas credenciales se usarán para crear esquemas y roles dedicados para cada aplicación de DeepAI Coder.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="db_host" render={({ field }) => (<FormItem><FormLabel>Host / IP</FormLabel><FormControl><Input placeholder="192.168.1.10" {...field} disabled={isSaving} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="db_port" render={({ field }) => (<FormItem><FormLabel>Puerto</FormLabel><FormControl><Input type="number" {...field} disabled={isSaving} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="db_name" render={({ field }) => (<FormItem><FormLabel>Nombre de la Base de Datos</FormLabel><FormControl><Input {...field} disabled={isSaving} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="db_user" render={({ field }) => (<FormItem><FormLabel>Usuario Administrador</FormLabel><FormControl><Input {...field} disabled={isSaving} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="db_password" render={({ field }) => (<FormItem><FormLabel>Contraseña de Administrador</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} disabled={isSaving} /></FormControl><FormMessage /></FormItem>)} />
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar Configuración
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}