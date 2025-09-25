"use client";

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

export interface ApiKey {
  id: string;
  provider: string;
  api_key: string | null; // Masked
  nickname: string | null;
  project_id: string | null;
  location_id: string | null;
  use_vertex_ai: boolean;
  model_name: string | null;
  api_endpoint: string | null; // New
  json_key_content: string | null; // FIXED: Added json_key_content
}

export function useUserApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchKeys = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/ai-keys');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setKeys(data);
    } catch (error: any) {
      toast.error(`Error al cargar las claves de API: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  return { userApiKeys: keys, isLoadingApiKeys: isLoading, refreshApiKeys: fetchKeys };
}