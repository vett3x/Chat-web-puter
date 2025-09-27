"use client";

import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Upload, XCircle } from 'lucide-react';
import { AI_PROVIDERS } from '@/lib/ai-models';
import { ApiKeyFormValues } from '@/components/api-management-dialog'; // Import the type

interface ApiKeyFormFieldsProps {
  form: UseFormReturn<ApiKeyFormValues>;
  isSubmitting: boolean;
  selectedProvider: string;
  useVertexAI: boolean;
  jsonKeyFileInputRef: React.RefObject<HTMLInputElement | null>; // Fixed: Allow null
  selectedJsonKeyFile: File | null;
  jsonKeyFileName: string | null;
  handleJsonKeyFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveJsonKeyFile: () => void;
  isSuperAdmin: boolean;
  editingKeyId: string | null;
}

const providerOptions = AI_PROVIDERS.filter(p => p.source === 'user_key').map(p => ({
  value: p.value,
  label: p.company,
  models: p.models,
}));

export function ApiKeyFormFields({
  form,
  isSubmitting,
  selectedProvider,
  useVertexAI,
  jsonKeyFileInputRef,
  selectedJsonKeyFile,
  jsonKeyFileName,
  handleJsonKeyFileChange,
  handleRemoveJsonKeyFile,
  isSuperAdmin,
  editingKeyId,
}: ApiKeyFormFieldsProps) {
  const currentProviderModels = providerOptions.find(p => p.value === selectedProvider)?.models || [];
  const isGoogleGemini = selectedProvider === 'google_gemini';
  const isCustomEndpoint = selectedProvider === 'custom_endpoint';

  return (
    <div className="space-y-4">
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
                      handleRemoveJsonKeyFile();
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
        <>
          <FormField control={form.control} name="api_key" render={({ field }) => (
            <FormItem>
              <FormLabel>API Key</FormLabel>
              <FormControl><Input type="password" placeholder={editingKeyId ? "Dejar en blanco para no cambiar" : "Pega tu API key aquí"} {...field} disabled={isSubmitting} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="nickname" render={({ field }) => (
            <FormItem>
              <FormLabel>Apodo (Opcional)</FormLabel>
              <FormControl><Input placeholder="Ej: Clave personal, Clave de equipo" {...field} disabled={isSubmitting} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </>
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
    </div>
  );
}