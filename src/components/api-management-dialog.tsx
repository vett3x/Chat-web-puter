"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, PlusCircle, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const apiKeySchema = z.object({
  provider: z.string().min(1, { message: 'Debes seleccionar un proveedor.' }),
  api_key: z.string().min(10, { message: 'La API Key parece demasiado corta.' }),
  nickname: z.string().optional(),
});

type ApiKeyFormValues = z.infer<typeof apiKeySchema>;

interface ApiKey {
  id: string;
  provider: string;
  api_key: string; // Masked
  nickname: string | null;
  created_at: string;
}

interface ApiManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiManagementDialog({ open, onOpenChange }: ApiManagementDialogProps) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: { provider: 'google_gemini', api_key: '', nickname: '' },
  });

  const fetchKeys = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/ai-keys');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setKeys(data);
    } catch (error: any) {
      toast.error(`Error al cargar las claves: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchKeys();
    }
  }, [open, fetchKeys]);

  const onSubmit = async (values: ApiKeyFormValues) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/ai-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success('API Key guardada.');
      form.reset();
      fetchKeys();
    } catch (error: any) {
      toast.error(`Error al guardar la clave: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (keyId: string) => {
    try {
      const response = await fetch(`/api/ai-keys?id=${keyId}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success('API Key eliminada.');
      fetchKeys();
    } catch (error: any) {
      toast.error(`Error al eliminar la clave: ${error.message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-6 h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-6 w-6" /> Gestión de API Keys de IA
          </DialogTitle>
          <DialogDescription>
            Añade y gestiona tus API keys para diferentes proveedores de IA. Estas claves se usarán para las conversaciones.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6 flex-1 overflow-hidden flex flex-col">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Añadir Nueva API Key</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="provider" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proveedor</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un proveedor" /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="google_gemini">Google Gemini</SelectItem></SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="api_key" render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Key</FormLabel>
                      <FormControl><Input type="password" placeholder="Pega tu API key aquí" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="nickname" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apodo (Opcional)</FormLabel>
                      <FormControl><Input placeholder="Ej: Clave personal, Clave de equipo" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                    Añadir Clave
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
          <Separator />
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold">Claves Guardadas</h3>
              <Button variant="ghost" size="icon" onClick={fetchKeys} disabled={isLoading}><RefreshCw className="h-4 w-4" /></Button>
            </div>
            <ScrollArea className="flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Apodo</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Clave</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                  ) : keys.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No hay claves guardadas.</TableCell></TableRow>
                  ) : (
                    keys.map(key => (
                      <TableRow key={key.id}>
                        <TableCell>{key.nickname || 'N/A'}</TableCell>
                        <TableCell>{key.provider}</TableCell>
                        <TableCell className="font-mono text-xs">{key.api_key}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="destructive" size="icon" onClick={() => handleDelete(key.id)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cerrar</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}