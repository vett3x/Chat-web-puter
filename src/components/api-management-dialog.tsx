"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { KeyRound, PlusCircle, Trash2, Loader2, RefreshCw, Edit, Upload, XCircle, Search } from 'lucide-react';
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
import { AI_PROVIDERS, getModelLabel } from '@/lib/ai-models';
import { useSession } from '@/components/session-context-provider';
import { ApiKeyFormFields } from './api-management/api-key-form-fields'; // Import the new component

// Schema for API Key form validation
const apiKeySchema = z.object({
  id: z.string().optional(),
  provider: z.string().min(1, { message: 'Debes seleccionar un proveedor.' }),
  api_key: z.string().trim().optional().or(z.literal('')),
  nickname: z.string().trim().optional().or(z.literal('')),
  project_id: z.string().trim().optional().or(z.literal('')),
  location_id: z.string().trim().optional().or(z.literal('')),
  use_vertex_ai: z.boolean().optional(),
  model_name: z.string().trim().optional().or(z.literal('')),
  json_key_file: z.any().optional(),
  json_key_content: z.string().optional(),
  api_endpoint: z.string().trim().url({ message: 'URL de endpoint inválida.' }).optional().or(z.literal('')),
  is_global: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.provider === 'google_gemini') {
    if (data.use_vertex_ai) {
      if (!data.model_name || data.model_name === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Debes seleccionar un modelo para usar Vertex AI.', path: ['model_name'] });
      }
      if (!data.project_id || data.project_id === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Project ID es requerido para usar Vertex AI.', path: ['project_id'] });
      }
      if (!data.location_id || data.location_id === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Location ID es requerido para usar Vertex AI.', path: ['location_id'] });
      }
      // For new keys, json_key_file is required. For existing, it's optional if content already exists.
      // This specific check is better handled in onSubmit based on editingKeyId and existing content.
    } else { // Public API
      if (!data.model_name || data.model_name === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Debes seleccionar un modelo para la API pública de Gemini.', path: ['model_name'] });
      }
      if (!data.api_key || data.api_key === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'API Key es requerida para la API pública de Gemini.', path: ['api_key'] });
      }
    }
  } else if (data.provider === 'custom_endpoint') {
    if (!data.api_endpoint || data.api_endpoint === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El link del endpoint es requerido para un endpoint personalizado.', path: ['api_endpoint'] });
    }
    if (!data.model_name || data.model_name === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El ID del modelo es requerido para un endpoint personalizado.', path: ['model_name'] });
    }
    if (!data.nickname || data.nickname === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El apodo es obligatorio para un endpoint personalizado.', path: ['nickname'] });
    }
    if (!data.api_key || data.api_key === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'API Key es requerida para un endpoint personalizado.', path: ['api_key'] });
    }
  } else { // Other providers
    if (!data.api_key || data.api_key === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'API Key es requerida para este proveedor.', path: ['api_key'] });
    }
  }
});

export type ApiKeyFormValues = z.infer<typeof apiKeySchema>;

interface ApiKey {
  id: string;
  provider: string;
  api_key: string; // Masked
  nickname: string | null;
  created_at: string;
  project_id: string | null;
  location_id: string | null;
  use_vertex_ai: boolean;
  model_name: string | null;
  json_key_content: string | null; // To check if content exists
  api_endpoint: string | null;
  is_global: boolean;
  user_id: string | null;
}

interface ApiManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiManagementDialog({ open, onOpenChange }: ApiManagementDialogProps) {
  const { session, userRole } = useSession();
  const isSuperAdmin = userRole === 'super_admin';
  const currentUserId = session?.user?.id;

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const jsonKeyFileInputRef = useRef<HTMLInputElement>(null);
  const [selectedJsonKeyFile, setSelectedJsonKeyFile] = useState<File | null>(null);
  const [jsonKeyFileName, setJsonKeyFileName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const form = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      provider: '',
      api_key: '',
      nickname: '',
      project_id: '',
      location_id: '',
      use_vertex_ai: false,
      model_name: '',
      json_key_file: undefined,
      json_key_content: undefined,
      api_endpoint: '',
      is_global: false,
    },
  });

  const selectedProvider = form.watch('provider');
  const useVertexAI = !!form.watch('use_vertex_ai'); // Fixed: Ensure boolean type
  const isGoogleGemini = selectedProvider === 'google_gemini';

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
        model_name: '',
        json_key_file: undefined,
        json_key_content: undefined,
        api_endpoint: '',
        is_global: false,
      });
      setEditingKeyId(null);
      setSelectedJsonKeyFile(null);
      setJsonKeyFileName(null);
      setSearchQuery('');
    }
  }, [open, fetchKeys, form]);

  const handleEditKey = (key: ApiKey) => {
    setEditingKeyId(key.id);
    form.reset({
      id: key.id,
      provider: key.provider,
      nickname: key.nickname || '',
      api_key: '',
      project_id: key.project_id || '',
      location_id: key.location_id || '',
      use_vertex_ai: key.use_vertex_ai || false,
      model_name: key.model_name || '',
      json_key_file: undefined,
      json_key_content: undefined,
      api_endpoint: key.api_endpoint || '',
      is_global: key.is_global,
    });
    setSelectedJsonKeyFile(null);
    setJsonKeyFileName(key.use_vertex_ai && key.json_key_content ? 'Archivo JSON existente' : null);
  };

  const handleCancelEdit = () => {
    setEditingKeyId(null);
    form.reset({
      provider: '',
      api_key: '',
      nickname: '',
      project_id: '',
      location_id: '',
      use_vertex_ai: false,
      model_name: '',
      json_key_file: undefined,
      json_key_content: undefined,
      api_endpoint: '',
      is_global: false,
    });
    setSelectedJsonKeyFile(null);
    setJsonKeyFileName(null);
  };

  const handleJsonKeyFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/json') {
        toast.error('Por favor, sube un archivo JSON válido.');
        setSelectedJsonKeyFile(null);
        setJsonKeyFileName(null);
        return;
      }
      setSelectedJsonKeyFile(file);
      setJsonKeyFileName(file.name);
    } else {
      setSelectedJsonKeyFile(null);
      setJsonKeyFileName(null);
    }
  };

  const handleRemoveJsonKeyFile = () => {
    setSelectedJsonKeyFile(null);
    setJsonKeyFileName(null);
    if (jsonKeyFileInputRef.current) {
      jsonKeyFileInputRef.current.value = '';
    }
  };

  const onSubmit = async (values: ApiKeyFormValues) => {
    setIsSubmitting(true);

    try {
      const method = editingKeyId ? 'PUT' : 'POST';
      const payload: ApiKeyFormValues = { ...values };
      
      if (editingKeyId) {
        payload.id = editingKeyId;
        if (payload.api_key === '') {
          delete payload.api_key;
        }
      }

      if (payload.use_vertex_ai) {
        payload.api_key = undefined;
        if (selectedJsonKeyFile) {
          payload.json_key_content = await selectedJsonKeyFile.text();
        } else if (editingKeyId && !selectedJsonKeyFile && jsonKeyFileName === 'Archivo JSON existente') {
          // If editing, using Vertex AI, no new file, and old file existed, keep existing content
          // By not including json_key_content in payload, it won't be updated to null
        } else {
          payload.json_key_content = undefined;
        }
        payload.api_endpoint = undefined;
      } else if (selectedProvider === 'custom_endpoint') {
        payload.project_id = undefined;
        payload.location_id = undefined;
        payload.json_key_content = undefined;
        payload.use_vertex_ai = false;
      } else {
        payload.project_id = undefined;
        payload.location_id = undefined;
        payload.json_key_content = undefined;
        payload.use_vertex_ai = false;
        payload.api_endpoint = undefined;
      }

      const response = await fetch('/api/ai-keys', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (jsonError) {
        throw new Error(`Respuesta inesperada del servidor: ${responseText.substring(0, 100)}...`);
      }

      if (!response.ok) {
        if (result.errors) {
          result.errors.forEach((err: any) => {
            form.setError(err.path[0], { message: err.message });
          });
        }
        throw new Error(result.message || `Error HTTP: ${response.status}`);
      }
      toast.success(`API Key ${editingKeyId ? 'actualizada' : 'guardada'}.`);
      handleCancelEdit();
      fetchKeys();
    } catch (error: any) {
      toast.error(`Error: ${error.message || 'Ocurrió un error desconocido al guardar la clave.'}`);
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
      if (editingKeyId === keyId) {
        handleCancelEdit();
      }
    } catch (error: any) {
      toast.error(`Error al eliminar la clave: ${error.message}`);
    }
  };

  const filteredKeys = keys.filter(key => {
    const lowerCaseQuery = searchQuery.toLowerCase();
    const providerLabel = AI_PROVIDERS.find(p => p.value === key.provider)?.company || key.provider;
    
    return (
      (key.nickname && key.nickname.toLowerCase().includes(lowerCaseQuery)) ||
      (providerLabel.toLowerCase().includes(lowerCaseQuery)) ||
      (key.model_name && getModelLabel(key.model_name ?? undefined).toLowerCase().includes(lowerCaseQuery)) ||
      (key.project_id && key.project_id.toLowerCase().includes(lowerCaseQuery)) ||
      (key.location_id && key.location_id.toLowerCase().includes(lowerCaseQuery)) ||
      (key.api_endpoint && key.api_endpoint.toLowerCase().includes(lowerCaseQuery))
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-6 max-h-[90vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-6 w-6" /> Gestión de API Keys de IA
          </DialogTitle>
          <DialogDescription>
            Añade y gestiona tus API keys para diferentes proveedores de IA. Estas claves se usarán para las conversaciones.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6 flex-1 flex flex-col">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{editingKeyId ? 'Actualizar API Key' : 'Añadir Nueva API Key'}</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <ApiKeyFormFields
                    form={form}
                    isSubmitting={isSubmitting}
                    selectedProvider={selectedProvider}
                    useVertexAI={useVertexAI}
                    jsonKeyFileInputRef={jsonKeyFileInputRef}
                    selectedJsonKeyFile={selectedJsonKeyFile}
                    jsonKeyFileName={jsonKeyFileName}
                    handleJsonKeyFileChange={handleJsonKeyFileChange}
                    handleRemoveJsonKeyFile={handleRemoveJsonKeyFile}
                    isSuperAdmin={isSuperAdmin}
                    editingKeyId={editingKeyId}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={isSubmitting || !selectedProvider}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingKeyId ? <Edit className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)}
                      {editingKeyId ? 'Actualizar' : 'Añadir Clave'}
                    </Button>
                    {editingKeyId && (
                      <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={isSubmitting}>
                        Cancelar Edición
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
          <Separator />
          <div className="flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold">Claves Guardadas</h3>
              <div className="relative flex-1 max-w-xs ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar clave..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="ghost" size="icon" onClick={fetchKeys} disabled={isLoading}><RefreshCw className="h-4 w-4" /></Button>
            </div>
            <ScrollArea className="flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Apodo</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Clave / Configuración</TableHead>
                    {isSuperAdmin && <TableHead>Global</TableHead>}
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={isSuperAdmin ? 5 : 4} className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                  ) : filteredKeys.length === 0 ? (
                    <TableRow><TableCell colSpan={isSuperAdmin ? 5 : 4} className="text-center text-muted-foreground">No hay claves que coincidan con la búsqueda.</TableCell></TableRow>
                  ) : (
                    filteredKeys
                      .map(key => {
                        const canManageKey = isSuperAdmin || (!key.is_global && key.user_id === currentUserId);

                        return (
                          <TableRow key={key.id}>
                            <TableCell>{key.nickname || 'N/A'}</TableCell>
                            <TableCell>{AI_PROVIDERS.find(p => p.value === key.provider)?.company || key.provider}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {key.provider === 'custom_endpoint' ? (
                                <div className="flex flex-col">
                                  <span>Endpoint: {key.api_endpoint || 'N/A'}</span>
                                  <span className="text-muted-foreground">Modelo ID: {key.model_name || 'N/A'}</span>
                                  <span className="text-muted-foreground">API Key: {key.api_key ? `${key.api_key.substring(0, 4)}...${key.api_key.substring(key.api_key.length - 4)}` : 'N/A'}</span>
                                </div>
                              ) : key.use_vertex_ai ? (
                                <div className="flex flex-col">
                                  <span>Vertex AI (Activo)</span>
                                  <span className="text-muted-foreground">Project: {key.project_id || 'N/A'}</span>
                                  <span className="text-muted-foreground">Location: {key.location_id || 'N/A'}</span>
                                  <span className="text-muted-foreground">Modelo: {getModelLabel(key.model_name ?? undefined) || 'N/A'}</span>
                                  {key.json_key_content && <span className="text-muted-foreground">JSON Key: Subido</span>}
                                </div>
                              ) : (
                                <div className="flex flex-col">
                                  <span>{key.api_key}</span>
                                  <span className="text-muted-foreground">Modelo: {getModelLabel(key.model_name ?? undefined) || 'N/A'}</span>
                                </div>
                              )}
                            </TableCell>
                            {isSuperAdmin && (
                              <TableCell>
                                {key.is_global ? 'Sí' : 'No'}
                              </TableCell>
                            )}
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  onClick={() => handleEditKey(key)} 
                                  disabled={editingKeyId !== null || !canManageKey}
                                  title={!canManageKey ? "No tienes permiso para editar esta clave" : "Editar clave"}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="destructive" 
                                  size="icon" 
                                  onClick={() => handleDelete(key.id)} 
                                  disabled={editingKeyId !== null || !canManageKey}
                                  title={!canManageKey ? "No tienes permiso para eliminar esta clave" : "Eliminar clave"}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
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