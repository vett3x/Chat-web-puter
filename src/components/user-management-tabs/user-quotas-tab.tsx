"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Server, Dock, Globe, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const quotasFormSchema = z.object({
  max_servers: z.coerce.number().int().min(0, 'El valor no puede ser negativo.'),
  max_containers: z.coerce.number().int().min(0, 'El valor no puede ser negativo.'),
  max_tunnels: z.coerce.number().int().min(0, 'El valor no puede ser negativo.'),
});

type QuotasFormValues = z.infer<typeof quotasFormSchema>;

interface UserQuotas {
  max_servers: number;
  max_containers: number;
  max_tunnels: number;
}

interface UserQuotasTabProps {
  userId: string;
  userName: string;
  currentUserRole: 'user' | 'admin' | 'super_admin' | null;
  targetUserRole: 'user' | 'admin' | 'super_admin';
  onQuotasUpdated: () => void;
}

export function UserQuotasTab({ userId, userName, currentUserRole, targetUserRole, onQuotasUpdated }: UserQuotasTabProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = currentUserRole === 'super_admin' && targetUserRole !== 'super_admin';

  const form = useForm<QuotasFormValues>({
    resolver: zodResolver(quotasFormSchema),
    defaultValues: {
      max_servers: 0,
      max_containers: 0,
      max_tunnels: 0,
    },
  });

  const fetchQuotas = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/users/${userId}/quotas`, { credentials: 'include' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: UserQuotas = await response.json();
      form.reset(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar las cuotas del usuario.');
      toast.error(err.message || 'Error al cargar las cuotas del usuario.');
    } finally {
      setIsLoading(false);
    }
  }, [userId, form]);

  useEffect(() => {
    if (userId) {
      fetchQuotas();
    }
  }, [userId, fetchQuotas]);

  const onSubmit = async (values: QuotasFormValues) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/users/${userId}/quotas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        credentials: 'include',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      onQuotasUpdated(); // Refresh user list to show new values
    } catch (err: any) {
      toast.error(`Error al actualizar las cuotas: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-full text-destructive"><AlertCircle className="h-6 w-6 mr-2" />{error}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestión de Cuotas de Recursos</CardTitle>
        <CardDescription>
          Define los límites de recursos que {userName} puede crear.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="max_servers" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2"><Server className="h-4 w-4" /> Máximo de Servidores</FormLabel>
                <FormControl><Input type="number" {...field} disabled={!canEdit || isSaving} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="max_containers" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2"><Dock className="h-4 w-4" /> Máximo de Contenedores</FormLabel>
                <FormControl><Input type="number" {...field} disabled={!canEdit || isSaving} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="max_tunnels" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2"><Globe className="h-4 w-4" /> Máximo de Túneles</FormLabel>
                <FormControl><Input type="number" {...field} disabled={!canEdit || isSaving} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            
            {canEdit ? (
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar Cuotas
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Solo los Super Admins pueden modificar las cuotas de otros usuarios (excepto otros Super Admins).
              </p>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}