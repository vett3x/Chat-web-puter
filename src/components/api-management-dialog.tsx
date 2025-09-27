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
import { KeyRound, PlusCircle, Trash2, Loader2, RefreshCw, Edit, Upload, XCircle, Search } from 'lucide-react'; // Import Search icon
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
import { AI_PROVIDERS, getModelLabel } from '@/lib/ai-models'; // Import AI_PROVIDERS
import { useSession } from '@/components/session-context-provider'; // NEW: Import useSession

const apiKeySchema = z.object({
  id: z.string().optional(), // Added for editing existing keys
  provider: z.string().min(1, { message: 'Debes seleccionar un proveedor.' }),
  api_key: z.string().trim().optional().or(z.literal('')), // Changed: Allow empty string for optional API key
  nickname: z.string().trim().optional().or(z.literal('')), // Changed: Allow empty string for optional nickname
  // New fields for Vertex AI
  project_id: z.string().trim().optional().or(z.literal('')), // Changed: Allow empty string for optional project_id
  location_id: z.string().trim().optional().or(z.literal('')), // Changed: Allow empty string for optional location_id
  use_vertex_ai: z.boolean().optional(),
  model_name: z.string().trim().optional().or(z.literal('')), // Changed: Allow empty string for optional model_name
  json_key_file: z.any().optional(), // New: for file upload
  json_key_content: z.string().optional(), // Added for payload
  api_endpoint: z.string().trim().url({ message: 'URL de endpoint inválida.' }).optional().or(z.literal('')), // Changed: Allow empty string for optional api_endpoint
  is_global: z.boolean().optional(), // NEW: Add is_global to schema
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
  api_endpoint: string | null; // New: for custom endpoint
  is_global: boolean; // NEW: Add is_global
  user_id: string | null; // NEW: Add user_id for permission checks
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
  const { session, userRole } = useSession(); // NEW: Get userRole
  const isSuperAdmin = userRole === 'super_admin'; // NEW: Check if Super Admin
  const currentUserId = session?.user?.id;

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null); // Track which key is being edited
  const jsonKeyFileInputRef = useRef<HTMLInputElement>(null);
  const [selectedJsonKeyFile, setSelectedJsonKeyFile] = useState<File | null>(null);
  const [jsonKeyFileName, setJsonKeyFileName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(''); // New state for search query

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
      is_global: false, // NEW: Default to false
    },
  });

  const selectedProvider = form.watch('provider');
  const useVertexAI = form.watch('use_vertex_ai');
  const currentProviderModels = providerOptions.find(p => p.value === selectedProvider)?.models || [];
  const isGoogleGemini = selectedProvider === 'google_gemini';
  const isCustomEndpoint = selectedProvider === 'custom_endpoint';

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
        is_global: false, // NEW: Reset is_global
      });
      setEditingKeyId(null);
      setSelectedJsonKeyFile(null);
      setJsonKeyFileName(null);
      setSearchQuery(''); // Reset search query on dialog open
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
      api_endpoint: key.api_endpoint || '', // Pre-fill api_endpoint
      is_global: key.is_global, // NEW: Pre-fill is_global
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
      api_endpoint: '',
      is_global: false, // NEW: Reset is_global
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
    let hasValidationError = false;

    // --- Manual validation for NEW keys or when specific fields are required ---
    if (!editingKeyId) { // Stricter validation for creating NEW keys
      if (values.provider === 'google_gemini') {
        if (values.use_vertex_ai) {
          if (!values.model_name) { form.setError('model_name', { message: 'Debes seleccionar un modelo.' }); hasValidationError = true; }
          if (!values.project_id) { form.setError('project_id', { message: 'Project ID es requerido.' }); hasValidationError = true; }
          if (!values.location_id) { form.setError('location_id', { message: 'Location ID es requerido.' }); hasValidationError = true; }
        } else {
          if (!values.model_name) { form.setError('model_name', { message: 'Debes seleccionar un modelo.' }); hasValidationError = true; }
          if (!values.api_key) { form.setError('api_key', { message: 'API Key es requerida.' }); hasValidationError = true; }
        }
      } else if (values.provider === 'custom_endpoint') {
        if (!values.api_endpoint) { form.setError('api_endpoint', { message: 'El link del endpoint es requerido.' }); hasValidationError = true; }
        if (!values.model_name) { form.setError('model_name', { message: 'El ID del modelo es requerido.' }); hasValidationError = true; }
        if (!values.nickname) { form.setError('nickname', { message: 'El apodo es obligatorio.' }); hasValidationError = true; }
        if (!values.api_key) { form.setError('api_key', { message: 'API Key es requerida.' }); hasValidationError = true; }
      } else { // Other providers
        if (!values.api_key) { form.setError('api_key', { message: 'API Key es requerida.' }); hasValidationError = true; }
      }
    }
    
    if (hasValidationError) {
      setIsSubmitting(false);
      return;
    }
    // --- End manual validation ---

    try {
      const method = editingKeyId ? 'PUT' : 'POST';
      const payload: ApiKeyFormValues = { ...values };
      
      if (editingKeyId) {
        payload.id = editingKeyId; // Ensure ID is in payload for PUT
        // If api_key field is empty during an update, delete it from payload so backend doesn't update it to an empty string
        if (payload.api_key === '') {
          delete payload.api_key;
        }
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
          // If editing, using Vertex AI, no new file, and no old file, set to undefined
          payload.json_key_content = undefined;
        }
        // Clear custom endpoint fields if switching to Vertex AI
        payload.api_endpoint = undefined;
      } else if (isCustomEndpoint) {
        // If using custom endpoint, clear Vertex AI specific fields
        payload.project_id = undefined;
        payload.location_id = undefined;
        payload.json_key_content = undefined;
        payload.use_vertex_ai = false;
      } else {
        // If not using Vertex AI or custom endpoint, clear Vertex AI specific fields and custom endpoint fields
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
      
      const responseText = await response.text(); // Read response text first
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (jsonError) {
        throw new Error(`Respuesta inesperada del servidor: ${responseText.substring(0, 100)}...`);
      }

      if (!response.ok) {
        // If there are validation errors from the backend, display them
        if (result.errors) {
          result.errors.forEach((err: any) => {
            form.setError(err.path[0], { message: err.message });
          });
        }
        throw new Error(result.message || `Error HTTP: ${response.status}`);
      }
      toast.success(`API Key ${editingKeyId ? 'actualizada' : 'guardada'}.`);
      handleCancelEdit(); // Clear form and editing state
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
    const providerLabel = providerOptions.find(p => p.value === key.provider)?.label || key.provider;
    
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
                                Puedes encontrar tu Project ID en el <a href="https://console.cloud.google.com/welcome" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Dashboard de Google Cloud Console</a>.
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
                              <Select onValueChange={field.onChange} value={field.value || ''} disabled={isSubmitting}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un modelo" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {currentProviderModels.filter(m => m.apiType === 'vertex').map(model => (
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
                              <FormDescription>
                                Obtén tu API Key desde <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google AI Studio</a>.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="model_name" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Modelo de Gemini</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ''} disabled={isSubmitting}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un modelo" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {currentProviderModels.filter(m => m.apiType === 'public').map(model => (
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

                  {isCustomEndpoint && (
                    <>
                      <FormField control={form.control} name="nickname" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Apodo</FormLabel>
                          <FormControl><Input placeholder="Ej: Mi LLM Personalizado" {...field} disabled={isSubmitting} /></FormControl>
                          <FormDescription>
                            Este apodo se mostrará en el selector de modelos del chat.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="api_endpoint" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Link del Endpoint</FormLabel>
                          <FormControl><Input placeholder="https://tu-api.com/v1/chat/completions" {...field} disabled={isSubmitting} /></FormControl>
                          <FormDescription>
                            La URL completa de tu endpoint de chat (ej. compatible con OpenAI API).
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="api_key" render={({ field }) => (
                        <FormItem>
                          <FormLabel>API Key</FormLabel>
                          <FormControl><Input type="password" placeholder={editingKeyId ? "Dejar en blanco para no cambiar" : "Pega tu API key aquí"} {...field} disabled={isSubmitting} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="model_name" render={({ field }) => (
                        <FormItem>
                          <FormLabel>ID del Modelo</FormLabel>
                          <FormControl><Input placeholder="Ej: gpt-4o, llama3-8b-chat" {...field} disabled={isSubmitting} /></FormControl>
                          <FormDescription>
                            El ID del modelo que tu endpoint espera (ej. 'gpt-4o').
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </>
                  )}

                  {!isGoogleGemini && !isCustomEndpoint && (
                    <FormField control={form.control} name="api_key" render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Key</FormLabel>
                        <FormControl><Input type="password" placeholder={editingKeyId ? "Dejar en blanco para no cambiar" : "Pega tu API key aquí"} {...field} disabled={isSubmitting} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  {/* Conditional rendering for Nickname field (only for non-Google Gemini and non-Custom Endpoint) */}
                  {!isGoogleGemini && !isCustomEndpoint && (
                    <FormField control={form.control} name="nickname" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apodo (Opcional)</FormLabel>
                        <FormControl><Input placeholder="Ej: Clave personal, Clave de equipo" {...field} disabled={isSubmitting} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                  
                  {isSuperAdmin && ( // NEW: Only show for Super Admins
                    <FormField control={form.control} name="is_global" render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Clave Global</FormLabel>
                          <FormDescription>
                            Si está activado, esta clave estará disponible para todos los usuarios.
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
                  )}

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
              <div className="relative flex-1 max-w-xs ml-auto"> {/* Added ml-auto to push to right */}
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
                      .filter(key => isSuperAdmin || !key.is_global) // NEW: Filter out global keys for non-Super Admins in the table
                      .map(key => {
                        // Determine if the current user can edit/delete this key
                        const canManageKey = isSuperAdmin || (!key.is_global && key.user_id === currentUserId);

                        return (
                          <TableRow key={key.id}>
                            <TableCell>{key.nickname || 'N/A'}</TableCell>
                            <TableCell>{providerOptions.find(p => p.value === key.provider)?.label || key.provider}</TableCell>
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