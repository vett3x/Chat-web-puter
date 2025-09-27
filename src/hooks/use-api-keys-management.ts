"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useSession } from '@/components/session-context-provider';
import { getModelLabel } from '@/lib/ai-models'; // Import getModelLabel

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

interface ApiKeyFormValues {
  id?: string;
  provider: string;
  api_key?: string;
  nickname?: string;
  project_id?: string;
  location_id?: string;
  use_vertex_ai?: boolean;
  model_name?: string;
  json_key_file?: File;
  json_key_content?: string;
  api_endpoint?: string;
  is_global?: boolean;
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
    // Reset form values in the component using this hook
    // For now, we just set the editingKeyId and the component will react
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
          // Keep existing content, do nothing
        } else {
          payload.json_key_content = undefined;
        }
        payload.api_endpoint = undefined;
      } else if (payload.provider === 'custom_endpoint') {
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
        throw new Error(result.message || `Error HTTP: ${response.status}`);
      }
      toast.success(`API Key ${editingKeyId ? 'actualizada' : 'guardada'}.`);
      handleCancelEdit();
      formReset({
        provider: '', api_key: '', nickname: '', project_id: '', location_id: '',
        use_vertex_ai: false, model_name: '', json_key_file: undefined, json_key_content: undefined,
        api_endpoint: '', is_global: false,
      });
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