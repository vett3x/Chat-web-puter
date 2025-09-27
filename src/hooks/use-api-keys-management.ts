"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useSession } from '@/components/session-context-provider';
import { getModelLabel } from '@/lib/ai-models'; // Import getModelLabel
import * as z from 'zod'; // Import zod for schema definition

// Define the schema for form validation
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

export type ApiKeyFormValues = z.infer<typeof apiKeySchema>;

// Define default values for the form
const DEFAULT_FORM_VALUES: ApiKeyFormValues = {
  provider: '', api_key: '', nickname: '', project_id: '', location_id: '',
  use_vertex_ai: false, model_name: '', json_key_file: undefined, json_key_content: undefined,
  api_endpoint: '', is_global: false,
};

export interface ApiKey {
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

export function useApiKeysManagement() {
  const { session, userRole } = useSession();
  const isSuperAdmin = userRole === 'super_admin';
  const currentUserId = session?.user?.id;

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [selectedJsonKeyFile, setSelectedJsonKeyFile] = useState<File | null>(null);
  const [jsonKeyFileName, setJsonKeyFileName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  const handleEditKey = useCallback((key: ApiKey) => {
    setEditingKeyId(key.id);
    setSelectedJsonKeyFile(null);
    setJsonKeyFileName(key.use_vertex_ai && key.json_key_content ? 'Archivo JSON existente' : null);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingKeyId(null);
    setSelectedJsonKeyFile(null);
    setJsonKeyFileName(null);
  }, []);

  const handleJsonKeyFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
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
  }, []);

  const handleRemoveJsonKeyFile = useCallback(() => {
    setSelectedJsonKeyFile(null);
    setJsonKeyFileName(null);
  }, []);

  const handleSubmit = useCallback(async (values: ApiKeyFormValues, formReset: (values?: ApiKeyFormValues) => void) => {
    setIsSubmitting(true);
    try {
      const method = editingKeyId ? 'PUT' : 'POST';
      const payload: any = { ...values }; // Use 'any' for flexibility during construction

      // Clean up empty strings to be null for DB insertion/update
      const fieldsToNullIfEmpty = ['nickname', 'project_id', 'location_id', 'model_name', 'api_endpoint'];
      fieldsToNullIfEmpty.forEach(field => {
        if (typeof payload[field] === 'string' && payload[field].trim() === '') {
          payload[field] = null;
        }
      });

      if (editingKeyId) {
        payload.id = editingKeyId;
        // If API key is an empty string on edit, it means don't change it.
        // If it's not provided (undefined), also don't change it.
        // Only send if it's a non-empty string.
        if (typeof payload.api_key === 'string' && payload.api_key.trim() === '') {
          delete payload.api_key; // Don't update the API key if user left it blank
        }
      } else {
        // For new keys, if api_key is empty, set to null
        if (typeof payload.api_key === 'string' && payload.api_key.trim() === '') {
          payload.api_key = null;
        }
      }

      if (payload.use_vertex_ai) {
        payload.api_key = null; // Clear public API key if using Vertex AI
        if (selectedJsonKeyFile) {
          payload.json_key_content = await selectedJsonKeyFile.text();
        } else if (editingKeyId && jsonKeyFileName === 'Archivo JSON existente') {
          // Keep existing json_key_content, do nothing to payload.json_key_content
          // If it's an edit and no new file, and it was existing, don't send `undefined` or `null`
          // to avoid clearing it.
          delete payload.json_key_content;
        } else {
          payload.json_key_content = null; // Clear if no file selected and not existing
        }
        payload.api_endpoint = null; // Clear custom endpoint for Gemini
      } else if (payload.provider === 'custom_endpoint') {
        payload.project_id = null;
        payload.location_id = null;
        payload.json_key_content = null;
        payload.use_vertex_ai = false;
      } else { // Other providers (e.g., Anthropic if we add direct API key support)
        payload.project_id = null;
        payload.location_id = null;
        payload.json_key_content = null;
        payload.use_vertex_ai = false;
        payload.api_endpoint = null;
      }

      // Ensure is_global is explicitly boolean or null
      if (payload.is_global === undefined) {
        payload.is_global = false; // Default to false if not provided
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
        throw new Error(`Respuesta inesperada del servidor: ${responseText.substring(0, 100)}... (Error de JSON: ${jsonError})`);
      }

      if (!response.ok) {
        throw new Error(result.message || `Error HTTP: ${response.status}`);
      }
      toast.success(`API Key ${editingKeyId ? 'actualizada' : 'guardada'}.`);
      handleCancelEdit();
      formReset(DEFAULT_FORM_VALUES); // Use stable default values
      fetchKeys();
    } catch (error: any) {
      toast.error(`Error: ${error.message || 'Ocurrió un error desconocido al guardar la clave.'}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [editingKeyId, selectedJsonKeyFile, jsonKeyFileName, handleCancelEdit, fetchKeys]);

  const handleDelete = useCallback(async (keyId: string) => {
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
  }, [editingKeyId, handleCancelEdit, fetchKeys]);

  const filteredKeys = keys.filter(key => {
    const lowerCaseQuery = searchQuery.toLowerCase();
    const providerLabel = getModelLabel(key.provider); // Use getModelLabel for provider
    
    return (
      (key.nickname && key.nickname.toLowerCase().includes(lowerCaseQuery)) ||
      (providerLabel.toLowerCase().includes(lowerCaseQuery)) ||
      (key.model_name && getModelLabel(key.model_name ?? undefined).toLowerCase().includes(lowerCaseQuery)) ||
      (key.project_id && key.project_id.toLowerCase().includes(lowerCaseQuery)) ||
      (key.location_id && key.location_id.toLowerCase().includes(lowerCaseQuery)) ||
      (key.api_endpoint && key.api_endpoint.toLowerCase().includes(lowerCaseQuery))
    );
  });

  return {
    keys: filteredKeys,
    isLoading,
    isSubmitting,
    editingKeyId,
    selectedJsonKeyFile,
    jsonKeyFileName,
    searchQuery,
    isSuperAdmin,
    currentUserId,
    fetchKeys,
    handleEditKey,
    handleCancelEdit,
    handleJsonKeyFileChange,
    handleRemoveJsonKeyFile,
    handleSubmit,
    handleDelete,
    setSearchQuery,
  };
}