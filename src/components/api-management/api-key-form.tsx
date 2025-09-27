"use client";

import React, { useRef } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, PlusCircle, Edit, Upload, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AI_PROVIDERS, getModelLabel } from '@/lib/ai-models';

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
});

type ApiKeyFormValues = z.infer<typeof apiKeySchema>;

interface ApiKeyFormProps {
  form: UseFormReturn<ApiKeyFormValues>;
  onSubmit: (values: ApiKeyFormValues) => void;
  isSubmitting: boolean;
  editingKeyId: string | null;
  onCancelEdit: () => void;
  selectedJsonKeyFile: File | null;
  onJsonKeyFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveJsonKeyFile: () => void;
  jsonKeyFileName: string | null;
  isSuperAdmin: boolean;
}

const providerOptions = AI_PROVIDERS.filter(p => p.source === 'user_key').map(p => ({
  value: p.value,
  label: p.company,
  models: p.models,
}));

export function ApiKeyForm({
  form,
  onSubmit,
  isSubmitting,
  editingKeyId,
  onCancelEdit,
  selectedJsonKeyFile,
  onJsonKeyFileChange,
  onRemoveJsonKeyFile,
  jsonKeyFileName,
  isSuperAdmin,
}: ApiKeyFormProps) {
  const jsonKeyFileInputRef = useRef<HTMLInputElement>(null);

  const selectedProvider = form.watch('provider');
  const useVertexAI = form.watch('use_vertex_ai');
  const currentProviderModels = providerOptions.find(p => p.value === selectedProvider)?.models || [];
  const isGoogleGemini = selectedProvider === 'google_gemini';
  const isCustomEndpoint = selectedProvider === 'custom_endpoint';

  const handleFormSubmit = (values: ApiKeyFormValues) => {
    let hasValidationError = false;

    // Manual validation for NEW keys or when specific fields are required
    if (!editingKeyId) {
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
      } else {
        if (!values.api_key) { form.setError('api_key', { message: 'API Key es requerida.' }); hasValidationError = true; }
      }
    }
    
    if (hasValidationError) {
      return;
    }
    onSubmit(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
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
                      if (!checked) {
                        onRemoveJsonKeyFile(); // Clear file selection if switching off Vertex AI
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
                      onChange={onJsonKeyFileChange}
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
                        onClick={onRemoveJsonKeyFile}
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

        {!isGoogleGemini && !isCustomEndpoint && (
          <FormField control={form.control} name="nickname" render={({ field }) => (
            <FormItem>
              <FormLabel>Apodo (Opcional)</FormLabel>
              <FormControl><Input placeholder="Ej: Clave personal, Clave de equipo" {...field} disabled={isSubmitting} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        )}
        
        {isSuperAdmin && (
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
            <Button type="button" variant="outline" onClick={onCancelEdit} disabled={isSubmitting}>
              Cancelar Edición
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}