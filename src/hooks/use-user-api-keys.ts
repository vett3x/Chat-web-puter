"use client";

import { useState, useEffect, useCallback, useRef } from 'react'; // Import useRef
import { toast } from 'sonner';
import { useSession } from '@/components/session-context-provider'; // Import useSession
import { supabase } from '@/integrations/supabase/client'; // Import Supabase client

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
  user_id: string | null; // NEW: Add user_id for permission checks
}

export function useUserApiKeys() {
  const { session, isLoading: isSessionLoading } = useSession(); // Get session and loading state
  const userId = session?.user?.id;

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchKeys = useCallback(async () => {
    if (!userId) {
      setKeys([]);
      setIsLoading(false);
      return;
    }
    try {
      const response = await fetch('/api/ai-keys');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      
      // NEW: Only update state if the data has actually changed
      setKeys(prevKeys => {
        if (JSON.stringify(prevKeys) === JSON.stringify(data)) {
          return prevKeys; // No change, return previous state to prevent re-render
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem(`api_keys_${userId}`, JSON.stringify(data));
        }
        return data; // Data changed, update state
      });

    } catch (error: any) {
      toast.error(`Error al refrescar las claves de API: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [userId]); // Dependency on userId is correct

  useEffect(() => {
    if (isSessionLoading) return;

    if (userId) {
      const cachedKeys = typeof window !== 'undefined' ? localStorage.getItem(`api_keys_${userId}`) : null;
      if (cachedKeys) {
        try {
          const parsedCachedKeys = JSON.parse(cachedKeys);
          setKeys(parsedCachedKeys);
          setIsLoading(false);
        } catch (e) {
          console.error("Error parsing cached API keys:", e);
          localStorage.removeItem(`api_keys_${userId}`);
        }
      } else {
        setIsLoading(true);
      }
      fetchKeys();
    } else {
      setKeys([]);
      setIsLoading(false);
    }
  }, [userId, isSessionLoading, fetchKeys]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('user-api-keys-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_api_keys' },
        (payload) => {
          // Cast payload.new and payload.old to Partial<ApiKey> for type safety
          const newKey = payload.new as Partial<ApiKey>;
          const oldKey = payload.old as Partial<ApiKey>;
          // Check if the change is relevant to the current user or a global key
          const isRelevant = newKey?.user_id === userId || newKey?.is_global || oldKey?.user_id === userId || oldKey?.is_global;
          if (isRelevant) {
            fetchKeys();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchKeys]);

  return { userApiKeys: keys, isLoadingApiKeys: isLoading, refreshApiKeys: fetchKeys };
}