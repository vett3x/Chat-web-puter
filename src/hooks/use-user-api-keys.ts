"use client";

import { useState, useEffect, useCallback, useRef } from 'react'; // Import useRef
import { toast } from 'sonner';
import { useSession } from '@/components/session-context-provider'; // Import useSession

export interface ApiKey {
  id: string;
  provider: string;
  api_key: string | null; // Masked
  nickname: string | null;
  project_id: string | null;
  location_id: string | null;
  use_vertex_ai: boolean;
  model_name: string | null;
  api_endpoint: string | null;
  json_key_content: string | null;
  is_global: boolean; // NEW: Add is_global
}

const POLLING_INTERVAL = 30000; // 30 segundos

export function useUserApiKeys() {
  const { session, isLoading: isSessionLoading } = useSession(); // Get session and loading state
  const userId = session?.user?.id;

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for debounce

  const fetchKeys = useCallback(async () => {
    if (!userId) { // Only fetch if user is logged in
      setKeys([]);
      setIsLoading(false);
      return;
    }
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
  }, [userId]); // Depend on userId

  // Debounced version of fetchKeys
  const debouncedFetchKeys = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      fetchKeys();
    }, 300); // 300ms debounce
  }, [fetchKeys]);

  useEffect(() => {
    // Only start polling if userId is available
    if (userId) {
      const interval = setInterval(() => {
        if (document.visibilityState === 'visible') { // Only poll when tab is visible
          debouncedFetchKeys();
        }
      }, POLLING_INTERVAL);
      return () => clearInterval(interval);
    } else if (!isSessionLoading) {
      // Clear data and stop loading if no user
      setKeys([]);
      setIsLoading(false);
    }
  }, [userId, isSessionLoading, debouncedFetchKeys]); // Depend on userId

  return { userApiKeys: keys, isLoadingApiKeys: isLoading, refreshApiKeys: debouncedFetchKeys };
}