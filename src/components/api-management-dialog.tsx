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
import { KeyRound, PlusCircle, Trash2, Loader2, RefreshCw, Edit } from 'lucide-react';
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
import { AI_PROVIDERS } from '@/lib/ai-models';

const apiKeySchema = z.object({
  provider: z.string().min(1, { message: 'Debes seleccionar un proveedor.' }),
  api_key: z.string().optional(),
  nickname: z.string().optional(),
  api_endpoint: z.string().optional(),
  model_name: z.string().optional(),
}).refine(data => {
  if (data.provider === 'custom_openai') {
    return !!data.api_endpoint && z.string().url().safeParse(data.api_endpoint).success && !!data.model_name;
  }
  if (data.provider === 'google_gemini') {
    return !!data.model_name;
  }
  return true;
}, {
  message: 'Endpoint y Modelo son requeridos para APIs personalizadas, y el Modelo es requerido para Gemini.',
  path: ['model_name'],
});

type ApiKeyFormValues = z.infer<typeof apiKeySchema>;

interface ApiKey {
  id: string;
  provider: string;
  api_key: string; // Masked
  nickname: string | null;
  created_at: string;
  api_endpoint?: string | null;
  model_name?: string | null;
}

const providerOptions = [
  { value: 'google_gemini', label: 'Google Gemini' },
  { value: 'custom_openai', label: 'API Personalizada (Compatible con OpenAI)' },
];

interface ApiManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiManagementDialog({ open, onOpenChange }: ApiManagementDialogProps) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);

  const form = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: { provider: '', api_key: '', nickname: '', api_endpoint: '', model_name: '' },
  });

  const selectedProvider = form.watch('provider');

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
      setEditingKey(null);
    }
  }, [open, fetchKeys, form]);

  const handleEditClick = (key: ApiKey) => {
    setEditingKey(key);
    form.reset({
      provider: key.provider,
      nickname: key.nickname || '',
      api_key: '', // Clear for security
      api_endpoint: key.api_endpoint || '',
      model_name: key.model_name || '',
    });
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    form.reset();
  };

  const onSubmit = async (values: ApiKeyFormValues) => {
    setIsSubmitting(true);
    try {
      const isEditing = !!editingKey;
      if (!isEditing && (!values.api_key || values.api_key.length < 10)) {
        throw new Error('La API Key es requerida para una nueva configuración.');
      }

      const method = isEditing ? 'PUT' : 'POST';
      const payload = { ...values, id: editingKey?.id };
      if (isEditing && !payload.api_key) {
        delete payload.api_key;
      }

      const response = await fetch('/api/ai-keys', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(`API Key ${isEditing ? 'actualizada' : 'guardada'}.`);
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
      if (editingKey?.id === keyId) handleCancelEdit();
    } catch (error: any) {
      toast.error(`Error al eliminar la clave: ${error.message}`);
    }
  };

  const geminiModels = AI_PROVIDERS.find(p => p.company === 'Google')?.models || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-6 h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-6 w-6" /> Gestión de API Keys de IA</DialogTitle>
          <DialogDescription>Añade y gestiona tus API keys para diferentes proveedores de IA.</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6 flex-1 overflow-hidden flex flex-col">
          <Card>
            <CardHeader><CardTitle className="text-lg">{editingKey ? 'Editar API Key' : 'Añadir Nueva API Key'}</CardTitle></CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="provider" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proveedor</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!!editingKey}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un proveedor" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {providerOptions.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  {selectedProvider && (
                    <>
                      <FormField control={form.control} name="nickname" render={({ field }) => (<FormItem><FormLabel>Apodo (Opcional)</FormLabel><FormControl><Input placeholder="Ej: Clave personal, Clave de equipo" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="api_key" render={({ field }) => (<FormItem><FormLabel>API Key</FormLabel><FormControl><Input type="password" placeholder={editingKey ? "Dejar en blanco para no cambiar" : "Pega tu API key aquí"} {...field} /></FormControl><FormMessage /></FormItem>)} />
                      {selectedProvider === 'custom_openai' && (
                        <>
                          <FormField control={form.control} name="api_endpoint" render={({ field }) => (<FormItem><FormLabel>Endpoint de la API</FormLabel><FormControl><Input placeholder="https://api.a4f.co/v1" {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name="model_name" render={({ field }) => (<FormItem><FormLabel>Nombre del Modelo</FormLabel><FormControl><Input placeholder="Ej: gpt-4o" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </>
                      )}
                      {selectedProvider === 'google_gemini' && (
                        <FormField control={form.control} name="model_name" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Modelo de Gemini</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un modelo de Gemini" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {geminiModels.map(model => (<SelectItem key={model.value} value={model.value}>{model.label}</SelectItem>))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      )}
                      <div className="flex gap-2">
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingKey ? <Edit className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)}{editingKey ? 'Actualizar' : 'Añadir'}</Button>
                        {editingKey && <Button type="button" variant="outline" onClick={handleCancelEdit}>Cancelar</Button>}
                      </div>
                    </>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>
          <Separator />
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-2"><h3 className="text-lg font-semibold">Claves Guardadas</h3><Button variant="ghost" size="icon" onClick={fetchKeys} disabled={isLoading}><RefreshCw className="h-4 w-4" /></Button></div>
            <ScrollArea className="flex-1">
              <Table>
                <TableHeader><TableRow><TableHead>Apodo</TableHead><TableHead>Proveedor</TableHead><TableHead>Clave</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                <TableBody>
                  {isLoading ? (<TableRow><TableCell colSpan={4} className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>) : keys.length === 0 ? (<TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No hay claves guardadas.</TableCell></TableRow>) : (keys.map(key => (<TableRow key={key.id}><TableCell>{key.nickname || 'N/A'}</TableCell><TableCell>{providerOptions.find(p => p.value === key.provider)?.label || key.provider}</TableCell><TableCell className="font-mono text-xs">{key.api_key}</TableCell><TableCell className="text-right flex justify-end gap-2"><Button variant="outline" size="icon" onClick={() => handleEditClick(key)}><Edit className="h-4 w-4" /></Button><Button variant="destructive" size="icon" onClick={() => handleDelete(key.id)}><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>)))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </div>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cerrar</Button></DialogClose></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}