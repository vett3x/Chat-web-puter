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
  is_global: boolean;
  user_id: string | null;
  group_id: string | null;
  status: 'active' | 'failed' | 'blocked';
  status_message: string | null;
  is_active: boolean;
}

// NEW: Define AiKeyGroup interface
export interface AiKeyGroup {
  id: string;
  user_id: string | null;
  name: string;
  provider: string;
  model_name: string | null;
  is_global: boolean;
  created_at: string;
  updated_at: string;
  api_keys?: ApiKey[]; // Optional: to hold associated keys when fetched
}

export function useUserApiKeys() {
  const { session, isLoading: isSessionLoading, globalRefreshKey } = useSession(); // Get session and loading state
  const userId = session?.user?.id;

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [groups, setGroups] = useState<AiKeyGroup[]>([]); // NEW: State for groups
  const [isLoading, setIsLoading] = useState(true);
  const isInitialFetch = useRef(true); // Track initial fetch

  const fetchKeysAndGroups = useCallback(async () => { // Renamed fetchKeys to fetchKeysAndGroups
    if (!userId) {
      setKeys([]);
      setGroups([]); // Clear groups too
      setIsLoading(false);
      return;
    }
    try {
      const response = await fetch('/api/ai-keys');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      
      // NEW: Separate keys and groups from the API response
      setKeys(prevKeys => {
        if (JSON.stringify(prevKeys) === JSON.stringify(data.apiKeys)) {
          return prevKeys;
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem(`api_keys_${userId}`, JSON.stringify(data.apiKeys));
        }
        return data.apiKeys;
      });

      setGroups(prevGroups => {
        if (JSON.stringify(prevGroups) === JSON.stringify(data.aiKeyGroups)) {
          return prevGroups;
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem(`ai_key_groups_${userId}`, JSON.stringify(data.aiKeyGroups));
        }
        return data.aiKeyGroups;
      });

    } catch (error: any) {
      if (!isInitialFetch.current) {
        toast.error(`Error al refrescar las claves de API: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
      isInitialFetch.current = false;
    }
  }, [userId]);

  useEffect(() => {
    if (isSessionLoading) return;

    if (userId) {
      const cachedKeys = typeof window !== 'undefined' ? localStorage.getItem(`api_keys_${userId}`) : null;
      const cachedGroups = typeof window !== 'undefined' ? localStorage.getItem(`ai_key_groups_${userId}`) : null;
      
      if (cachedKeys) {
        try {
          setKeys(JSON.parse(cachedKeys));
        } catch (e) {
          console.error("Error parsing cached API keys:", e);
          localStorage.removeItem(`api_keys_${userId}`);
        }
      }
      if (cachedGroups) {
        try {
          setGroups(JSON.parse(cachedGroups));
        } catch (e) {
          console.error("Error parsing cached AI key groups:", e);
          localStorage.removeItem(`ai_key_groups_${userId}`);
        }
      }

      if (!cachedKeys && !cachedGroups) {
        setIsLoading(true);
      }
      fetchKeysAndGroups();
    } else {
      setKeys([]);
      setGroups([]);
      setIsLoading(false);
    }
  }, [userId, isSessionLoading, fetchKeysAndGroups]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channels = [
      supabase
        .channel('user-api-keys-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_api_keys' },
          (payload) => {
            const newKey = payload.new as Partial<ApiKey>;
            const oldKey = payload.old as Partial<ApiKey>;
            const isRelevant = newKey?.user_id === userId || newKey?.is_global || oldKey?.user_id === userId || oldKey?.is_global;
            if (isRelevant) {
              fetchKeysAndGroups();
            }
          }
        )
        .subscribe(),
      supabase
        .channel('ai-key-groups-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ai_key_groups' },
          (payload) => {
            const newGroup = payload.new as Partial<AiKeyGroup>;
            const oldGroup = payload.old as Partial<AiKeyGroup>;
            const isRelevant = newGroup?.user_id === userId || newGroup?.is_global || oldGroup?.user_id === userId || oldGroup?.is_global;
            if (isRelevant) {
              fetchKeysAndGroups();
            }
          }
        )
        .subscribe(),
    ];

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [userId, fetchKeysAndGroups, globalRefreshKey]);

  return { userApiKeys: keys, aiKeyGroups: groups, isLoadingApiKeys: isLoading, refreshApiKeys: fetchKeysAndGroups }; // NEW: Return aiKeyGroups
}