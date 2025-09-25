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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const apiKeySchema = z.object({
  provider: z.string().min(1, { message: 'Debes seleccionar un proveedor.' }),
  api_key: z.string().optional(), // Make optional for Vertex AI
  nickname: z.string().optional(),
  // New fields for Vertex AI
  project_id: z.string().optional(),
  location_id: z.string().optional(),
  use_vertex_ai: z.boolean().optional(),
});

type ApiKeyFormValues = z.infer<typeof apiKeySchema>;

interface ApiKey {
  id: string;
  provider: string;
  api_key: string; // Masked
  nickname: string | null;
  created_at: string;
  project_id: string | null; // New
  location_id: string | null; // New
  use_vertex_ai: boolean; // New
}

const providerOptions = [
  { value: 'google_gemini', label: 'Google Gemini' },
  { value: 'anthropic_claude', label: 'Anthropic Claude' },
];

interface ApiManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiManagementDialog({ open, onOpenChange }: ApiManagementDialogProps) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      provider: '',
      api_key: '',
      nickname: '',
      project_id: '',
      location_id: '',
      use_vertex_ai: false,
    },
  });

  const selectedProvider = form.watch('provider');
  const useVertexAI = form.watch('use_vertex_ai');

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
      form.reset({
        provider: '',
        api_key: '',
        nickname: '',
        project_id: '',
        location_id: '',
        use_vertex_ai: false,
      });
      setIsEditing(false);
    }
  }, [open, fetchKeys, form]);

  useEffect(() => {
    if (selectedProvider) {
      const existingKey = keys.find(k => k.provider === selectedProvider);
      if (existingKey) {
        setIsEditing(true);
        form.reset({
          provider: selectedProvider,
          nickname: existingKey.nickname || '',
          api_key: '', // API key is masked, so don't pre-fill
          project_id: existingKey.project_id || '',
          location_id: existingKey.location_id || '',
          use_vertex_ai: existingKey.use_vertex_ai || false,
        });
      } else {
        setIsEditing(false);
        form.reset({
          provider: selectedProvider,
          nickname: '',
          api_key: '',
          project_id: '',
          location_id: '',
          use_vertex_ai: false,
        });
      }
    } else {
      setIsEditing(false);
    }
  }, [selectedProvider, keys, form]);

  const onSubmit = async (values: ApiKeyFormValues) => {
    setIsSubmitting(true);
    try {
      if (!isEditing && !values.use_vertex_ai && (!values.api_key || values.api_key.length < 10)) {
        toast.error('La API Key es requerida y debe ser válida para un nuevo proveedor si no usas Vertex AI.');
        setIsSubmitting(false);
        return;
      }
      if (values.use_vertex_ai && (!values.project_id || !values.location_id)) {
        toast.error('Project ID y Location ID son requeridos para usar Vertex AI.');
        setIsSubmitting(false);
        return;
      }

      const method = isEditing ? 'PUT' : 'POST';
      const payload = { ...values };
      
      // If editing and API key is empty, don't send it to avoid overwriting with empty string
      if (isEditing && !payload.api_key) {
        delete payload.api_key;
      }
      // If using Vertex AI, ensure api_key is null/undefined
      if (payload.use_vertex_ai) {
        payload.api_key = undefined; // Will be stored as NULL in DB
      } else {
        // If not using Vertex AI, ensure project_id and location_id are null/undefined
        payload.project_id = undefined;
        payload.location_id = undefined;
      }

      const response = await fetch('/api/ai-keys', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(`API Key ${isEditing ? 'actualizada' : 'guardada'}.`);
      form.reset({
        provider: selectedProvider,
        api_key: '', // Clear API key field after submission
        nickname: values.nickname,
        project_id: values.project_id,
        location_id: values.location_id,
        use_vertex_ai: values.use_vertex_ai,
      });
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
      form.reset({
        provider: '',
        api_key: '',
        nickname: '',
        project_id: '',
        location_id: '',
        use_vertex_ai: false,
      }); // Reset form if the deleted key was being edited
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
              <CardTitle className="text-lg">{isEditing ? 'Actualizar API Key' : 'Añadir Nueva API Key'}</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="provider" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proveedor</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un proveedor" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {providerOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {selectedProvider === 'google_gemini' && (
                    <>
                      <FormField control={form.control} name="use_vertex_ai" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Usar Vertex AI</FormLabel>
                            <FormDescription>
                              Habilita esta opción para usar Google Vertex AI en lugar de la API pública de Gemini.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={isSubmitting}
                            />
                          </FormControl>
                        </FormItem>
                      )} />

                      {useVertexAI ? (
                        <>
                          <FormField control={form.control} name="project_id" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Google Cloud Project ID</FormLabel>
                              <FormControl><Input placeholder="tu-id-de-proyecto" {...field} disabled={isSubmitting} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="location_id" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Google Cloud Location ID</FormLabel>
                              <FormControl><Input placeholder="ej: us-central1 o global" {...field} disabled={isSubmitting} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </>
                      ) : (
                        <FormField control={form.control} name="api_key" render={({ field }) => (
                          <FormItem>
                            <FormLabel>API Key</FormLabel>
                            <FormControl><Input type="password" placeholder={isEditing ? "Dejar en blanco para no cambiar" : "Pega tu API key aquí"} {...field} disabled={isSubmitting} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      )}
                    </>
                  )}

                  {selectedProvider !== 'google_gemini' && (
                    <FormField control={form.control} name="api_key" render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Key</FormLabel>
                        <FormControl><Input type="password" placeholder={isEditing ? "Dejar en blanco para no cambiar" : "Pega tu API key aquí"} {...field} disabled={isSubmitting} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  <FormField control={form.control} name="nickname" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apodo (Opcional)</FormLabel>
                      <FormControl><Input placeholder="Ej: Clave personal, Clave de equipo" {...field} disabled={isSubmitting} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" disabled={isSubmitting || !selectedProvider}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isEditing ? <Edit className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)}
                    {isEditing ? 'Actualizar Clave' : 'Añadir Clave'}
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
                    <TableHead>Clave / Configuración Vertex AI</TableHead>
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
                        <TableCell>{providerOptions.find(p => p.value === key.provider)?.label || key.provider}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {key.use_vertex_ai ? (
                            <div className="flex flex-col">
                              <span>Vertex AI (Activo)</span>
                              <span className="text-muted-foreground">Project: {key.project_id || 'N/A'}</span>
                              <span className="text-muted-foreground">Location: {key.location_id || 'N/A'}</span>
                            </div>
                          ) : (
                            key.api_key
                          )}
                        </TableCell>
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