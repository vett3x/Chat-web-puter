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
import { KeyRound, PlusCircle, Trash2, Loader2, RefreshCw, Edit, X } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const apiKeySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, { message: 'El nombre es requerido.' }),
  api_endpoint: z.string().url({ message: 'Debe ser una URL válida.' }),
  api_key: z.string().min(10, { message: 'La API Key parece demasiado corta.' }),
  model_name: z.string().min(1, { message: 'El nombre del modelo es requerido.' }),
});

const updateApiKeySchema = apiKeySchema.partial().extend({
  id: z.string().uuid(),
  api_key: z.string().optional(), // Make key optional for updates
});

type ApiKeyFormValues = z.infer<typeof apiKeySchema>;

interface ApiKey {
  id: string;
  name: string;
  api_endpoint: string;
  model_name: string;
  api_key: string; // Masked
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
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);

  const form = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: { name: '', api_endpoint: '', api_key: '', model_name: '' },
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
      form.reset();
      setEditingKeyId(null);
    }
  }, [open, fetchKeys, form]);

  const handleEditClick = (key: ApiKey) => {
    setEditingKeyId(key.id);
    form.reset({
      id: key.id,
      name: key.name,
      api_endpoint: key.api_endpoint,
      model_name: key.model_name,
      api_key: '', // Clear for security, user must re-enter if they want to change it
    });
  };

  const handleCancelEdit = () => {
    setEditingKeyId(null);
    form.reset({ name: '', api_endpoint: '', api_key: '', model_name: '' });
  };

  const onSubmit = async (values: ApiKeyFormValues) => {
    setIsSubmitting(true);
    try {
      const isEditing = !!editingKeyId;
      const schema = isEditing ? updateApiKeySchema : apiKeySchema;
      const payload = schema.parse({ ...values, id: editingKeyId });

      if (isEditing && !payload.api_key) {
        delete payload.api_key; // Don't send empty key on update
      }

      const response = await fetch('/api/ai-keys', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(`Configuración de API ${isEditing ? 'actualizada' : 'guardada'}.`);
      handleCancelEdit();
      fetchKeys();
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
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
      if (editingKeyId === keyId) handleCancelEdit();
    } catch (error: any) {
      toast.error(`Error al eliminar la clave: ${error.message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] p-6 h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-6 w-6" /> Gestión de API Keys de IA</DialogTitle>
          <DialogDescription>Añade y gestiona tus API keys para diferentes proveedores de IA compatibles con OpenAI.</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6 flex-1 overflow-hidden flex flex-col">
          <Card>
            <CardHeader><CardTitle className="text-lg">{editingKeyId ? 'Editar Configuración de API' : 'Añadir Nueva Configuración de API'}</CardTitle></CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nombre</FormLabel><FormControl><Input placeholder="Ej: Mi API de a4f.co" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="api_endpoint" render={({ field }) => (<FormItem><FormLabel>Endpoint de la API</FormLabel><FormControl><Input placeholder="https://api.a4f.co/v1" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="api_key" render={({ field }) => (<FormItem><FormLabel>API Key</FormLabel><FormControl><Input type="password" placeholder={editingKeyId ? "Dejar en blanco para no cambiar" : "Pega tu API key aquí"} {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="model_name" render={({ field }) => (<FormItem><FormLabel>Nombre del Modelo</FormLabel><FormControl><Input placeholder="Ej: gpt-4o" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingKeyId ? <Edit className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)}{editingKeyId ? 'Actualizar' : 'Añadir'}</Button>
                    {editingKeyId && <Button type="button" variant="outline" onClick={handleCancelEdit}><X className="mr-2 h-4 w-4" /> Cancelar Edición</Button>}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
          <Separator />
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-2"><h3 className="text-lg font-semibold">Claves Guardadas</h3><Button variant="ghost" size="icon" onClick={fetchKeys} disabled={isLoading}><RefreshCw className="h-4 w-4" /></Button></div>
            <ScrollArea className="flex-1"><Table><TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Endpoint</TableHead><TableHead>Modelo</TableHead><TableHead>Clave</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading ? (<TableRow><TableCell colSpan={5} className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>) : keys.length === 0 ? (<TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No hay claves guardadas.</TableCell></TableRow>) : (keys.map(key => (<TableRow key={key.id}><TableCell>{key.name}</TableCell><TableCell className="font-mono text-xs">{key.api_endpoint}</TableCell><TableCell className="font-mono text-xs">{key.model_name}</TableCell><TableCell className="font-mono text-xs">{key.api_key}</TableCell><TableCell className="text-right flex justify-end gap-2"><Button variant="outline" size="icon" onClick={() => handleEditClick(key)}><Edit className="h-4 w-4" /></Button><Button variant="destructive" size="icon" onClick={() => handleDelete(key.id)}><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>)))}
              </TableBody>
            </Table></ScrollArea>
          </div>
        </div>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cerrar</Button></DialogClose></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}