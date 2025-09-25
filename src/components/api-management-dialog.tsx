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
import { KeyRound, PlusCircle, Trash2, Loader2, RefreshCw, Edit, Upload, XCircle } from 'lucide-react';
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
import { AI_PROVIDERS } from '@/lib/ai-models'; // Import AI_PROVIDERS

const apiKeySchema = z.object({
  id: z.string().optional(), // Added for editing existing keys
  provider: z.string().min(1, { message: 'Debes seleccionar un proveedor.' }),
  api_key: z.string().optional(), // Make optional for Vertex AI
  nickname: z.string().optional(),
  // New fields for Vertex AI
  project_id: z.string().optional(),
  location_id: z.string().optional(),
  use_vertex_ai: z.boolean().optional(),
  model_name: z.string().optional(), // New: model_name
  json_key_file: z.any().optional(), // New: for file upload
  json_key_content: z.string().optional(), // Added for payload
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
  model_name: string | null; // New
  json_key_content: string | null; // New: to check if content exists
}

const providerOptions = AI_PROVIDERS.filter(p => p.source === 'user_key').map(p => ({
  value: p.value,
  label: p.company,
  models: p.models, // Include models for public API
}));

interface ApiManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiManagementDialog({ open, onOpenChange }: ApiManagementDialogProps) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null); // Track which key is being edited
  const jsonKeyFileInputRef = useRef<HTMLInputElement>(null);
  const [selectedJsonKeyFile, setSelectedJsonKeyFile] = useState<File | null>(null);
  const [jsonKeyFileName, setJsonKeyFileName] = useState<string | null>(null);

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
    },
  });

  const selectedProvider = form.watch('provider');
  const useVertexAI = form.watch('use_vertex_ai');
  const currentProviderModels = providerOptions.find(p => p.value === selectedProvider)?.models || [];
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
      });
      setEditingKeyId(null);
      setSelectedJsonKeyFile(null);
      setJsonKeyFileName(null);
    }
  }, [open, fetchKeys, form]);

  const handleEditKey = (key: ApiKey) => {
    setEditingKeyId(key.id);
    form.reset({
      id: key.id,
      provider: key.provider,
      nickname: key.nickname || '',
      api_key: '', // API key is masked, so don't pre-fill
      project_id: key.project_id || '',
      location_id: key.location_id || '',
      use_vertex_ai: key.use_vertex_ai || false,
      model_name: key.model_name || '', // Pre-fill model_name
      json_key_file: undefined,
      json_key_content: undefined, // Don't pre-fill content, user must re-upload if needed
    });
    setSelectedJsonKeyFile(null);
    setJsonKeyFileName(key.use_vertex_ai && key.json_key_content ? 'Archivo JSON existente' : null); // Indicate if JSON key exists
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
      // Validation logic
      if (!values.use_vertex_ai && (!values.api_key || values.api_key.length < 10) && !editingKeyId) {
        toast.error('La API Key es requerida y debe ser válida para un nuevo proveedor si no usas Vertex AI.');
        setIsSubmitting(false);
        return;
      }
      if (values.use_vertex_ai && (!values.project_id || !values.location_id)) {
        toast.error('Project ID y Location ID son requeridos para usar Vertex AI.');
        setIsSubmitting(false);
        return;
      }
      if (values.use_vertex_ai && !values.model_name) {
        toast.error('Debes seleccionar un modelo para usar Vertex AI.');
        setIsSubmitting(false);
        return;
      }
      if (values.use_vertex_ai && !selectedJsonKeyFile && !editingKeyId) {
        toast.error('Debes subir el archivo JSON de la cuenta de servicio para Vertex AI.');
        setIsSubmitting(false);
        return;
      }

      const method = editingKeyId ? 'PUT' : 'POST';
      const payload: ApiKeyFormValues = { ...values };
      
      if (editingKeyId) {
        payload.id = editingKeyId; // Ensure ID is in payload for PUT
      }

      // If editing and API key is empty, don't send it to avoid overwriting with empty string
      if (editingKeyId && !payload.api_key) {
        delete payload.api_key;
      }
      // If using Vertex AI, ensure api_key is null/undefined
      if (payload.use_vertex_ai) {
        payload.api_key = undefined; // Will be stored as NULL in DB
        if (selectedJsonKeyFile) {
          payload.json_key_content = await selectedJsonKeyFile.text(); // Read file content
        } else if (editingKeyId && !selectedJsonKeyFile && jsonKeyFileName === 'Archivo JSON existente') {
          // If editing, using Vertex AI, no new file, and old file existed, keep existing content
          // Do nothing, json_key_content will not be in payload, so it won't be updated to null
        } else {
          // If editing, using Vertex AI, no new file, and no old file, set to null
          // Or if adding new and no file, set to null
          payload.json_key_content = undefined;
        }
      } else {
        // If not using Vertex AI, ensure project_id, location_id, model_name, and json_key_content are null/undefined
        payload.project_id = undefined;
        payload.location_id = undefined;
        payload.model_name = undefined;
        payload.json_key_content = undefined;
      }

      const response = await fetch('/api/ai-keys', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(`API Key ${editingKeyId ? 'actualizada' : 'guardada'}.`);
      handleCancelEdit(); // Clear form and editing state
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
      if (editingKeyId === keyId) {
        handleCancelEdit();
      }
    } catch (error: any) {
      toast.error(`Error al eliminar la clave: ${error.message}`);
    }
  };

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
                  <FormField control={form.control} name="provider" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proveedor</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting || editingKeyId !== null}>
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

                  {isGoogleGemini && (
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
                              onCheckedChange={(checked) => {
                                field.onChange(checked);
                                // Clear file selection if switching off Vertex AI
                                if (!checked) {
                                  setSelectedJsonKeyFile(null);
                                  setJsonKeyFileName(null);
                                  if (jsonKeyFileInputRef.current) {
                                    jsonKeyFileInputRef.current.value = '';
                                  }
                                }
                              }}
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
                              <FormDescription>
                                Puedes encontrar tu Project ID en el <a href="https://console.cloud.google.com/home/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Dashboard de Google Cloud Console</a>.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="location_id" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Google Cloud Location ID</FormLabel>
                              <FormControl><Input placeholder="ej: us-central1 o global" {...field} disabled={isSubmitting} /></FormControl>
                              <FormDescription>
                                Consulta las <a href="https://cloud.google.com/vertex-ai/docs/general/locations" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">ubicaciones disponibles para Vertex AI</a>.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="model_name" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Modelo de Gemini (Vertex AI)</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ''} disabled={isSubmitting}> {/* Added || '' to value */}
                                <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un modelo" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {currentProviderModels.filter(m => !m.value.includes('-public-api')).map(model => (
                                    <SelectItem key={model.value} value={model.value}>{model.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormItem>
                            <FormLabel>Archivo JSON de Cuenta de Servicio</FormLabel>
                            <div className="flex items-center space-x-2">
                              <Input
                                id="json_key_file"
                                type="file"
                                accept="application/json"
                                onChange={handleJsonKeyFileChange}
                                ref={jsonKeyFileInputRef}
                                className="hidden"
                                disabled={isSubmitting}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => jsonKeyFileInputRef.current?.click()}
                                disabled={isSubmitting}
                                className="flex-1"
                              >
                                <Upload className="mr-2 h-4 w-4" /> {jsonKeyFileName ? jsonKeyFileName : "Subir archivo JSON"}
                              </Button>
                              {jsonKeyFileName && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={handleRemoveJsonKeyFile}
                                  disabled={isSubmitting}
                                >
                                  <XCircle className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                            <FormDescription>
                              Sube el archivo JSON de tu cuenta de servicio de Google Cloud.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        </>
                      ) : (
                        <>
                          <FormField control={form.control} name="api_key" render={({ field }) => (
                            <FormItem>
                              <FormLabel>API Key</FormLabel>
                              <FormControl><Input type="password" placeholder={editingKeyId ? "Dejar en blanco para no cambiar" : "Pega tu API key aquí"} {...field} disabled={isSubmitting} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="model_name" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Modelo de Gemini</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ''} disabled={isSubmitting}> {/* Added || '' to value */}
                                <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un modelo" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {currentProviderModels.filter(m => m.value.includes('-public-api')).map(model => (
                                    <SelectItem key={model.value} value={model.value}>{model.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </>
                      )}
                    </>
                  )}

                  {selectedProvider !== 'google_gemini' && (
                    <FormField control={form.control} name="api_key" render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Key</FormLabel>
                        <FormControl><Input type="password" placeholder={editingKeyId ? "Dejar en blanco para no cambiar" : "Pega tu API key aquí"} {...field} disabled={isSubmitting} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  {/* Conditional rendering for Nickname field */}
                  {!isGoogleGemini && (
                    <FormField control={form.control} name="nickname" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apodo (Opcional)</FormLabel>
                        <FormControl><Input placeholder="Ej: Clave personal, Clave de equipo" {...field} disabled={isSubmitting} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                  
                  <div className="flex gap-2">
                    <Button type="submit" disabled={isSubmitting || !selectedProvider}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingKeyId ? <Edit className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)}
                      {editingKeyId ? 'Actualizar Clave' : 'Añadir Clave'}
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
                              <span className="text-muted-foreground">Modelo: {key.model_name || 'N/A'}</span>
                              {key.json_key_content && <span className="text-muted-foreground">JSON Key: Subido</span>}
                            </div>
                          ) : (
                            <>
                              <span>{key.api_key}</span>
                              {key.model_name && <span className="text-muted-foreground">Modelo: {key.model_name}</span>}
                            </>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="icon" onClick={() => handleEditKey(key)} disabled={editingKeyId !== null}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="destructive" size="icon" onClick={() => handleDelete(key.id)} disabled={editingKeyId !== null}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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