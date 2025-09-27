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
  api_key: z.string().optional(), // Make optional for Vertex AI
  nickname: z.string().optional(),
  // New fields for Vertex AI
  project_id: z.string().optional(),
  location_id: z.string().optional(),
  use_vertex_ai: z.boolean().optional(),
  model_name: z.string().optional(), // This needs to be conditional
  json_key_file: z.any().optional(), // New: for file upload
  json_key_content: z.string().optional(), // Added for payload
  api_endpoint: z.string().url({ message: 'URL de endpoint inválida.' }).optional(), // New: for custom endpoint
  is_global: z.boolean().optional(), // NEW: Add is_global to schema
}).superRefine((data, ctx) => {
  if (data.provider === 'google_gemini') {
    if (data.use_vertex_ai) {
      if (!data.model_name || data.model_name === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Debes seleccionar un modelo para usar Vertex AI.',
          path: ['model_name'],
        });
      }
      if (!data.project_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Project ID es requerido para usar Vertex AI.',
          path: ['project_id'],
        });
      }
      if (!data.location_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Location ID es requerido para usar Vertex AI.',
          path: ['location_id'],
        });
      }
    } else { // Public API
      if (!data.model_name || data.model_name === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Debes seleccionar un modelo para la API pública de Gemini.',
          path: ['model_name'],
        });
      }
      // REMOVED: API key validation for adding new keys from here. It's now handled manually in onSubmit.
    }
  } else if (data.provider === 'custom_endpoint') { // New validation for custom_endpoint
    if (!data.api_endpoint || data.api_endpoint === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El link del endpoint es requerido para un endpoint personalizado.',
        path: ['api_endpoint'],
      });
    }
    // REMOVED: API key validation for adding new keys from here. It's now handled manually in onSubmit.
    if (!data.model_name || data.model_name === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El ID del modelo es requerido para un endpoint personalizado.',
        path: ['model_name'],
      });
    }
    if (!data.nickname || data.nickname === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El apodo es obligatorio para un endpoint personalizado.',
        path: ['nickname'],
      });
    }
  }
});

// The updateApiKeySchema is not used by useForm, so its superRefine doesn't matter for the form validation.
// I will remove it to avoid confusion.
// REMOVED updateApiKeySchema entirely.

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
  const { userRole } = useSession(); // NEW: Get userRole
  const isSuperAdmin = userRole === 'super_admin'; // NEW: Check if Super Admin

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
    try {
      const method = editingKeyId ? 'PUT' : 'POST';
      const payload: ApiKeyFormValues = { ...values };
      
      if (editingKeyId) {
        payload.id = editingKeyId; // Ensure ID is in payload for PUT
      }

      // --- Manual validation for API Key when CREATING a NEW key ---
      if (!editingKeyId) { // If creating a NEW key
        if (payload.provider === 'google_gemini' && !payload.use_vertex_ai && (!payload.api_key || payload.api_key === '')) {
          form.setError('api_key', { type: 'manual', message: 'API Key es requerida para la API pública de Gemini.' });
          setIsSubmitting(false);
          return;
        }
        if (payload.provider === 'custom_endpoint' && (!payload.api_key || payload.api_key === '')) {
          form.setError('api_key', { type: 'manual', message: 'La API Key es requerida para un endpoint personalizado.' });
          setIsSubmitting(false);
          return;
        }
        // For other providers (if added later)
        if (!isGoogleGemini && !isCustomEndpoint && (!payload.api_key || payload.api_key === '')) {
          form.setError('api_key', { type: 'manual', message: 'API Key es requerida.' });
          setIsSubmitting(false);
          return;
        }
      } else { // If EDITING an existing key
        // If api_key field is empty, delete it from payload so backend doesn't update it
        if (payload.api_key === '') {
          delete payload.api_key;
        }
      }
      // --- End manual validation ---

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
        // payload.api_key is handled by the custom validation above
        payload.project_id = undefined;
        payload.location_id = undefined;
        payload.json_key_content = undefined;
        payload.use_vertex_ai = false;
        // Ensure nickname and model_name are present for custom endpoint
        if (!payload.nickname) payload.nickname = 'Endpoint Personalizado';
        if (!payload.model_name) payload.model_name = 'custom-model';
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
                    filteredKeys.map(key => (
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