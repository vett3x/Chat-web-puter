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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KeyRound, PlusCircle, Trash2, Loader2, RefreshCw, Edit, Upload, XCircle, Search, Folder, CheckCircle2, AlertCircle, Ban, ChevronDown, ChevronRight } from 'lucide-react';
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
import { ApiKey, AiKeyGroup } from '@/hooks/use-user-api-keys';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';


// Schemas
const apiKeySchema = z.object({
  id: z.string().optional(),
  group_id: z.string().uuid().optional().nullable(),
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
  is_active: z.boolean().optional(), // NEW: Add is_active
  status: z.enum(['active', 'failed', 'blocked']).optional(),
  status_message: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.provider === 'google_gemini') {
    if (data.use_vertex_ai) {
      if (!data.model_name || data.model_name === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Debes seleccionar un modelo para usar Vertex AI.', path: ['model_name'] });
      }
      if (!data.project_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Project ID es requerido para usar Vertex AI.', path: ['project_id'] });
      }
      if (!data.location_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Location ID es requerido para usar Vertex AI.', path: ['location_id'] });
      }
    } else {
      if (!data.model_name || data.model_name === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Debes seleccionar un modelo para la API pública de Gemini.', path: ['model_name'] });
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
  }
});

const aiKeyGroupSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, { message: 'El nombre del grupo es requerido.' }),
  provider: z.string().min(1),
  model_name: z.string().trim().optional().or(z.literal('')),
  is_global: z.boolean().optional(),
});

type ApiKeyFormValues = z.infer<typeof apiKeySchema>;
type AiKeyGroupFormValues = z.infer<typeof aiKeyGroupSchema>;

const providerOptions = AI_PROVIDERS.filter(p => p.source === 'user_key').map(p => ({
  value: p.value,
  label: p.company,
  models: p.models,
}));

interface ApiManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiManagementDialog({ open, onOpenChange }: ApiManagementDialogProps) {
  const { session, userRole } = useSession();
  const isSuperAdmin = userRole === 'super_admin';
  const currentUserId = session?.user?.id;

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [groups, setGroups] = useState<AiKeyGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const jsonKeyFileInputRef = useRef<HTMLInputElement>(null);
  const [selectedJsonKeyFile, setSelectedJsonKeyFile] = useState<File | null>(null);
  const [jsonKeyFileName, setJsonKeyFileName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const apiKeyForm = useForm<ApiKeyFormValues>({
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
      is_active: true,
      group_id: null,
      status: 'active',
      status_message: null,
    },
  });

  const aiKeyGroupForm = useForm<AiKeyGroupFormValues>({
    resolver: zodResolver(aiKeyGroupSchema),
    defaultValues: {
      name: '',
      provider: '',
      model_name: '',
      is_global: false,
    },
  });

  const selectedProvider = apiKeyForm.watch('provider');
  const useVertexAI = apiKeyForm.watch('use_vertex_ai');
  const currentProviderModels = providerOptions.find(p => p.value === selectedProvider)?.models || [];
  const isGoogleGemini = selectedProvider === 'google_gemini';
  const isCustomEndpoint = selectedProvider === 'custom_endpoint';

  const getUniqueModelsForProvider = useCallback((providerValue: string) => {
    const provider = AI_PROVIDERS.find(p => p.value === providerValue);
    if (!provider) return [];
    const uniqueModelsMap = new Map<string, { value: string; label: string; apiType?: string }>();
    provider.models.forEach(model => {
      if (!uniqueModelsMap.has(model.value)) {
        uniqueModelsMap.set(model.value, model);
      }
    });
    return Array.from(uniqueModelsMap.values());
  }, []);

  const fetchKeysAndGroups = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/ai-keys');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setKeys(data.apiKeys);
      setGroups(data.aiKeyGroups);
    } catch (error: any) {
      toast.error(`Error al cargar las claves: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchKeysAndGroups();
      apiKeyForm.reset({
        provider: '', api_key: '', nickname: '', project_id: '', location_id: '', use_vertex_ai: false, model_name: '', json_key_file: undefined, json_key_content: undefined, api_endpoint: '', is_global: false, is_active: true, group_id: null, status: 'active', status_message: null,
      });
      aiKeyGroupForm.reset({ name: '', provider: '', model_name: '', is_global: false });
      setEditingKeyId(null);
      setEditingGroupId(null);
      setSelectedJsonKeyFile(null);
      setJsonKeyFileName(null);
      setSearchQuery('');
    }
  }, [open, fetchKeysAndGroups, apiKeyForm, aiKeyGroupForm]);

  const handleEditKey = (key: ApiKey) => {
    setEditingKeyId(key.id);
    setEditingGroupId(null);
    apiKeyForm.reset({
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
      is_active: key.is_active,
      group_id: key.group_id,
      status: key.status,
      status_message: key.status_message,
    });
    setSelectedJsonKeyFile(null);
    setJsonKeyFileName(key.use_vertex_ai && key.json_key_content ? 'Archivo JSON existente' : null);
    setIsAddEditDialogOpen(true);
  };

  const handleEditGroup = (group: AiKeyGroup) => {
    setEditingGroupId(group.id);
    setEditingKeyId(null);
    aiKeyGroupForm.reset({
      id: group.id,
      name: group.name,
      provider: group.provider,
      model_name: group.model_name || '',
      is_global: group.is_global,
    });
    setIsAddEditDialogOpen(true);
  };

  const handleCancelEdit = () => {
    setEditingKeyId(null);
    setEditingGroupId(null);
    apiKeyForm.reset({
      provider: '', api_key: '', nickname: '', project_id: '', location_id: '', use_vertex_ai: false, model_name: '', json_key_file: undefined, json_key_content: undefined, api_endpoint: '', is_global: false, is_active: true, group_id: null, status: 'active', status_message: null,
    });
    aiKeyGroupForm.reset({ name: '', provider: '', model_name: '', is_global: false });
    setSelectedJsonKeyFile(null);
    setJsonKeyFileName(null);
    setIsAddEditDialogOpen(false);
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

  const onApiKeySubmit = async (values: ApiKeyFormValues) => {
    setIsSubmitting(true);
    let hasValidationError = false;

    if (!editingKeyId) {
      if (values.provider === 'google_gemini') {
        if (values.use_vertex_ai) {
          if (!values.model_name) { apiKeyForm.setError('model_name', { message: 'Debes seleccionar un modelo.' }); hasValidationError = true; }
          if (!values.project_id) { apiKeyForm.setError('project_id', { message: 'Project ID es requerido.' }); hasValidationError = true; }
          if (!values.location_id) { apiKeyForm.setError('location_id', { message: 'Location ID es requerido.' }); hasValidationError = true; }
        } else {
          if (!values.model_name) { apiKeyForm.setError('model_name', { message: 'Debes seleccionar un modelo.' }); hasValidationError = true; }
          if (!values.api_key) { apiKeyForm.setError('api_key', { message: 'API Key es requerida.' }); hasValidationError = true; }
        }
      } else if (values.provider === 'custom_endpoint') {
        if (!values.api_endpoint) { apiKeyForm.setError('api_endpoint', { message: 'El link del endpoint es requerido.' }); hasValidationError = true; }
        if (!values.model_name) { apiKeyForm.setError('model_name', { message: 'El ID del modelo es requerido.' }); hasValidationError = true; }
        if (!values.nickname) { apiKeyForm.setError('nickname', { message: 'El apodo es obligatorio.' }); hasValidationError = true; }
        if (!values.api_key) { apiKeyForm.setError('api_key', { message: 'API Key es requerida.' }); hasValidationError = true; }
      } else {
        if (!values.api_key) { apiKeyForm.setError('api_key', { message: 'API Key es requerida.' }); hasValidationError = true; }
      }
    }
    
    if (hasValidationError) {
      setIsSubmitting(false);
      return;
    }

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
          // Keep existing content if editing, Vertex AI, no new file, and old file existed
        } else {
          payload.json_key_content = undefined;
        }
        payload.api_endpoint = undefined;
      } else if (isCustomEndpoint) {
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
            apiKeyForm.setError(err.path[0], { message: err.message });
          });
        }
        throw new Error(result.message || `Error HTTP: ${response.status}`);
      }
      toast.success(`API Key ${editingKeyId ? 'actualizada' : 'guardada'}.`);
      handleCancelEdit();
      fetchKeysAndGroups();
    } catch (error: any) {
      toast.error(`Error: ${error.message || 'Ocurrió un error desconocido al guardar la clave.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onAiKeyGroupSubmit = async (values: AiKeyGroupFormValues) => {
    setIsSubmitting(true);
    try {
      const method = editingGroupId ? 'PUT' : 'POST';
      const response = await fetch('/api/ai-key-groups', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingGroupId ? { ...values, id: editingGroupId } : values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(`Grupo de claves ${editingGroupId ? 'actualizado' : 'creado'}.`);
      handleCancelEdit();
      fetchKeysAndGroups();
    } catch (error: any) {
      toast.error(`Error: ${error.message || 'Ocurrió un error desconocido al guardar el grupo.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, type: 'key' | 'group') => {
    try {
      const response = await fetch(`/api/ai-keys?id=${id}&type=${type}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(`${type === 'key' ? 'API Key' : 'Grupo de claves'} eliminada.`);
      fetchKeysAndGroups();
      if (editingKeyId === id || editingGroupId === id) {
        handleCancelEdit();
      }
    } catch (error: any) {
      toast.error(`Error al eliminar: ${error.message}`);
    }
  };

  const filteredGroups = groups.filter(group => {
    const lowerCaseQuery = searchQuery.toLowerCase();
    const providerLabel = providerOptions.find(p => p.value === group.provider)?.label || group.provider;
    return (
      group.name.toLowerCase().includes(lowerCaseQuery) ||
      providerLabel.toLowerCase().includes(lowerCaseQuery) ||
      (group.model_name && getModelLabel(group.model_name).toLowerCase().includes(lowerCaseQuery)) ||
      group.api_keys?.some(key => 
        (key.nickname && key.nickname.toLowerCase().includes(lowerCaseQuery)) ||
        (key.model_name && getModelLabel(key.model_name).toLowerCase().includes(lowerCaseQuery))
      )
    );
  });

  const filteredStandaloneKeys = keys.filter(key => {
    const lowerCaseQuery = searchQuery.toLowerCase();
    const providerLabel = providerOptions.find(p => p.value === key.provider)?.label || key.provider;
    return (
      (key.nickname && key.nickname.toLowerCase().includes(lowerCaseQuery)) ||
      providerLabel.toLowerCase().includes(lowerCaseQuery) ||
      (key.model_name && getModelLabel(key.model_name).toLowerCase().includes(lowerCaseQuery)) ||
      (key.project_id && key.project_id.toLowerCase().includes(lowerCaseQuery)) ||
      (key.location_id && key.location_id.toLowerCase().includes(lowerCaseQuery)) ||
      (key.api_endpoint && key.api_endpoint.toLowerCase().includes(lowerCaseQuery))
    );
  });

  const renderStatusBadge = (key: ApiKey) => {
    if (!key.is_active) {
      return <Badge variant="secondary">Inactiva</Badge>;
    }
    switch (key.status) {
      case 'active':
        return <Badge className="bg-green-500 text-white">Activa</Badge>;
      case 'failed':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Fallida
            {key.status_message && <span className="ml-1 text-xs opacity-80" title={key.status_message}>({key.status_message.substring(0, 20)}...)</span>}
          </Badge>
        );
      case 'blocked':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <Ban className="h-3 w-3" /> Bloqueada
            {key.status_message && <span className="ml-1 text-xs opacity-80" title={key.status_message}>({key.status_message.substring(0, 20)}...)</span>}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{key.status}</Badge>;
    }
  };

  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] p-6 max-h-[90vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-6 w-6" /> Gestión de API Keys de IA
          </DialogTitle>
          <DialogDescription>
            Añade y gestiona tus API keys y grupos para diferentes proveedores de IA.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6 flex-1 flex flex-col">
          <Dialog open={isAddEditDialogOpen} onOpenChange={setIsAddEditDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="w-fit" onClick={handleCancelEdit}>
                <PlusCircle className="mr-2 h-4 w-4" /> Añadir Clave o Grupo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingKeyId ? 'Editar API Key' : (editingGroupId ? 'Editar Grupo de Claves' : 'Añadir Nueva Clave o Grupo')}</DialogTitle>
                <DialogDescription>
                  {editingKeyId ? 'Actualiza los detalles de tu API Key.' : (editingGroupId ? 'Actualiza los detalles de tu grupo de claves.' : 'Crea una nueva API Key o un grupo de claves.')}
                </DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="key" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="key" disabled={!!editingGroupId}>Añadir/Editar Clave</TabsTrigger>
                  <TabsTrigger value="group" disabled={!!editingKeyId}>Añadir/Editar Grupo</TabsTrigger>
                </TabsList>
                <TabsContent value="key">
                  <Form {...apiKeyForm}>
                    <form onSubmit={apiKeyForm.handleSubmit(onApiKeySubmit)} className="space-y-4 py-4">
                      <FormField control={apiKeyForm.control} name="provider" render={({ field }) => (
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
                          <FormField control={apiKeyForm.control} name="use_vertex_ai" render={({ field }) => (
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
                              <FormField control={apiKeyForm.control} name="project_id" render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Google Cloud Project ID</FormLabel>
                                  <FormControl><Input placeholder="tu-id-de-proyecto" {...field} disabled={isSubmitting} /></FormControl>
                                  <FormDescription>
                                    Puedes encontrar tu Project ID en el <a href="https://console.cloud.google.com/welcome" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Dashboard de Google Cloud Console</a>.
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )} />
                              <FormField control={apiKeyForm.control} name="location_id" render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Google Cloud Location ID</FormLabel>
                                  <FormControl><Input placeholder="ej: us-central1 o global" {...field} disabled={isSubmitting} /></FormControl>
                                  <FormDescription>
                                    Consulta las <a href="https://cloud.google.com/vertex-ai/docs/general/locations" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">ubicaciones disponibles para Vertex AI</a>.
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )} />
                              <FormField control={apiKeyForm.control} name="model_name" render={({ field }) => (
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
                              <FormField control={apiKeyForm.control} name="api_key" render={({ field }) => (
                                <FormItem>
                                  <FormLabel>API Key</FormLabel>
                                  <FormControl><Input type="password" placeholder={editingKeyId ? "Dejar en blanco para no cambiar" : "Pega tu API key aquí"} {...field} disabled={isSubmitting} /></FormControl>
                                  <FormDescription>
                                    Obtén tu API Key desde <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google AI Studio</a>.
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )} />
                              <FormField control={apiKeyForm.control} name="model_name" render={({ field }) => (
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
                          <FormField control={apiKeyForm.control} name="nickname" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Apodo</FormLabel>
                              <FormControl><Input placeholder="Ej: Mi LLM Personalizado" {...field} disabled={isSubmitting} /></FormControl>
                              <FormDescription>
                                Este apodo se mostrará en el selector de modelos del chat.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={apiKeyForm.control} name="api_endpoint" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Link del Endpoint</FormLabel>
                              <FormControl><Input placeholder="https://tu-api.com/v1/chat/completions" {...field} disabled={isSubmitting} /></FormControl>
                              <FormDescription>
                                La URL completa de tu endpoint de chat (ej. compatible con OpenAI API).
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={apiKeyForm.control} name="api_key" render={({ field }) => (
                            <FormItem>
                              <FormLabel>API Key</FormLabel>
                              <FormControl><Input type="password" placeholder={editingKeyId ? "Dejar en blanco para no cambiar" : "Pega tu API key aquí"} {...field} disabled={isSubmitting} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={apiKeyForm.control} name="model_name" render={({ field }) => (
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
                        <FormField control={apiKeyForm.control} name="api_key" render={({ field }) => (
                          <FormItem>
                            <FormLabel>API Key</FormLabel>
                            <FormControl><Input type="password" placeholder={editingKeyId ? "Dejar en blanco para no cambiar" : "Pega tu API key aquí"} {...field} disabled={isSubmitting} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      )}

                      {!isGoogleGemini && !isCustomEndpoint && (
                        <FormField control={apiKeyForm.control} name="nickname" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Apodo (Opcional)</FormLabel>
                            <FormControl><Input placeholder="Ej: Clave personal, Clave de equipo" {...field} disabled={isSubmitting} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      )}
                      
                      {isSuperAdmin && (
                        <FormField control={apiKeyForm.control} name="is_global" render={({ field }) => (
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

                      <FormField control={apiKeyForm.control} name="is_active" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Clave Activa</FormLabel>
                            <FormDescription>
                              Desactiva esta opción para deshabilitar temporalmente la clave sin eliminarla.
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

                      <FormField control={apiKeyForm.control} name="group_id" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Asignar a Grupo (Opcional)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''} disabled={isSubmitting}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un grupo" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="null">Sin Grupo</SelectItem>
                              {groups.filter(g => g.provider === selectedProvider && (g.user_id === currentUserId || g.is_global || isSuperAdmin)).map(group => (
                                <SelectItem key={group.id} value={group.id}>{group.name} {group.is_global && '(Global)'}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Las claves de Google Gemini se agrupan automáticamente si no se selecciona un grupo.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />

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
                </TabsContent>
                <TabsContent value="group">
                  <Form {...aiKeyGroupForm}>
                    <form onSubmit={aiKeyGroupForm.handleSubmit(onAiKeyGroupSubmit)} className="space-y-4 py-4">
                      <FormField control={aiKeyGroupForm.control} name="name" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre del Grupo</FormLabel>
                          <FormControl><Input placeholder="Ej: Mis Claves Gemini Principales" {...field} disabled={isSubmitting} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={aiKeyGroupForm.control} name="provider" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Proveedor</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting || editingGroupId !== null}>
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
                      <FormField control={aiKeyGroupForm.control} name="model_name" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Modelo por Defecto del Grupo (Opcional)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''} disabled={isSubmitting}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un modelo" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {getUniqueModelsForProvider(aiKeyGroupForm.watch('provider')).map(model => (
                                <SelectItem key={model.value} value={model.value}>{model.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Este modelo se usará por defecto para las claves de este grupo si no se especifica uno individual.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                      {isSuperAdmin && (
                        <FormField control={aiKeyGroupForm.control} name="is_global" render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel>Grupo Global</FormLabel>
                              <FormDescription>
                                Si está activado, este grupo y sus claves estarán disponibles para todos los usuarios.
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
                        <Button type="submit" disabled={isSubmitting || !aiKeyGroupForm.watch('provider')}>
                          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingGroupId ? <Edit className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)}
                          {editingGroupId ? 'Actualizar Grupo' : 'Crear Grupo'}
                        </Button>
                        {editingGroupId && (
                          <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={isSubmitting}>
                            Cancelar Edición
                          </Button>
                        )}
                      </div>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>

          <Separator />
          <div className="flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold">Claves y Grupos Guardados</h3>
              <div className="relative flex-1 max-w-xs ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar clave o grupo..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="ghost" size="icon" onClick={fetchKeysAndGroups} disabled={isLoading}><RefreshCw className="h-4 w-4" /></Button>
            </div>
            <ScrollArea className="flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Configuración</TableHead>
                    {isSuperAdmin && <TableHead>Global</TableHead>}
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={isSuperAdmin ? 6 : 5} className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                  ) : (
                    <>
                      {filteredGroups.map(group => {
                        const canManageGroup = isSuperAdmin || (group.user_id === currentUserId && !group.is_global);
                        const isExpanded = expandedGroups.has(group.id);
                        const activeKeysCount = group.api_keys?.filter(k => k.status === 'active' && k.is_active).length || 0;
                        return (
                          <React.Fragment key={group.id}>
                            <TableRow className="bg-muted/50 hover:bg-muted/70" onClick={() => toggleGroupExpansion(group.id)}>
                              <TableCell className="font-semibold flex items-center gap-2 cursor-pointer">
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                <Folder className="h-4 w-4" /> {group.name}
                              </TableCell>
                              <TableCell>{providerOptions.find(p => p.value === group.provider)?.label || group.provider}</TableCell>
                              <TableCell className="font-mono text-xs">
                                {group.model_name ? `Modelo: ${getModelLabel(group.model_name)}` : 'N/A'}
                              </TableCell>
                              {isSuperAdmin && <TableCell>{group.is_global ? 'Sí' : 'No'}</TableCell>}
                              <TableCell>
                                <Badge variant="secondary">{group.api_keys && group.api_keys.length > 0 ? `${activeKeysCount} activas` : 'Sin claves'}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                  <Button variant="outline" size="icon" onClick={() => handleEditGroup(group)} disabled={!canManageGroup} title={!canManageGroup ? "No tienes permiso para editar este grupo" : "Editar grupo"}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="destructive" size="icon" onClick={() => handleDelete(group.id, 'group')} disabled={!canManageGroup} title={!canManageGroup ? "No tienes permiso para eliminar este grupo" : "Eliminar grupo"}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                            {isExpanded && group.api_keys?.map(key => {
                              const canManageKey = isSuperAdmin || (key.user_id === currentUserId && !key.is_global);
                              return (
                                <TableRow key={key.id} className={cn(key.status === 'failed' && 'bg-destructive/10', key.status === 'blocked' && 'bg-red-900/20', !key.is_active && 'opacity-50')}>
                                  <TableCell className="pl-8"><div className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-muted-foreground" /> {key.nickname || 'N/A'}</div></TableCell>
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
                                  {isSuperAdmin && <TableCell>{key.is_global ? 'Sí' : 'No'}</TableCell>}
                                  <TableCell>{renderStatusBadge(key)}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button variant="outline" size="icon" onClick={() => handleEditKey(key)} disabled={!canManageKey} title={!canManageKey ? "No tienes permiso para editar esta clave" : "Editar clave"}>
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button variant="destructive" size="icon" onClick={() => handleDelete(key.id, 'key')} disabled={!canManageKey} title={!canManageKey ? "No tienes permiso para eliminar esta clave" : "Eliminar clave"}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                      {filteredStandaloneKeys.length > 0 && (
                        <TableRow className="bg-muted/50 hover:bg-muted/70">
                          <TableCell colSpan={isSuperAdmin ? 6 : 5} className="font-semibold">
                            <div className="flex items-center gap-2">
                              <KeyRound className="h-4 w-4" /> Claves Individuales
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      {filteredStandaloneKeys.map(key => {
                        const canManageKey = isSuperAdmin || (key.user_id === currentUserId && !key.is_global);
                        return (
                          <TableRow key={key.id} className={cn(key.status === 'failed' && 'bg-destructive/10', key.status === 'blocked' && 'bg-red-900/20', !key.is_active && 'opacity-50')}>
                            <TableCell><div className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> {key.nickname || 'N/A'}</div></TableCell>
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
                            {isSuperAdmin && <TableCell>{key.is_global ? 'Sí' : 'No'}</TableCell>}
                            <TableCell>{renderStatusBadge(key)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="icon" onClick={() => handleEditKey(key)} disabled={!canManageKey} title={!canManageKey ? "No tienes permiso para editar esta clave" : "Editar clave"}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="destructive" size="icon" onClick={() => handleDelete(key.id, 'key')} disabled={!canManageKey} title={!canManageKey ? "No tienes permiso para eliminar esta clave" : "Eliminar clave"}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredGroups.length === 0 && filteredStandaloneKeys.length === 0 && !isLoading && (
                        <TableRow><TableCell colSpan={isSuperAdmin ? 6 : 5} className="text-center text-muted-foreground">No hay claves o grupos que coincidan con la búsqueda.</TableCell></TableRow>
                      )}
                    </>
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