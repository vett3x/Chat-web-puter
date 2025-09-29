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
    // Don't set loading to true on background refreshes
    // setIsLoading(true); 
    try {
      const response = await fetch('/api/ai-keys');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setKeys(data);
      // Cache the fetched keys
      if (typeof window !== 'undefined') {
        localStorage.setItem(`api_keys_${userId}`, JSON.stringify(data));
      }
    } catch (error: any) {
      toast.error(`Error al refrescar las claves de API: ${error.message}`);
    } finally {
      setIsLoading(false); // Always set loading to false after fetch
    }
  }, [userId]); // Depend on userId

  useEffect(() => {
    if (isSessionLoading) {
      return; // Wait until session is loaded
    }

    if (userId) {
      // 1. Load from cache immediately
      const cachedKeys = typeof window !== 'undefined' ? localStorage.getItem(`api_keys_${userId}`) : null;
      if (cachedKeys) {
        try {
          setKeys(JSON.parse(cachedKeys));
          setIsLoading(false); // We have data, so we are not "loading" anymore
        } catch (e) {
          console.error("Failed to parse cached API keys", e);
          localStorage.removeItem(`api_keys_${userId}`);
        }
      } else {
        setIsLoading(true); // No cache, so we are in a loading state
      }

      // 2. Fetch fresh data in the background
      fetchKeys();

    } else {
      // No user, clear everything
      setKeys([]);
      setIsLoading(false);
      if (typeof window !== 'undefined') {
        // Attempt to clear any stray cache
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('api_keys_')) {
            localStorage.removeItem(key);
          }
        });
      }
    }
  }, [userId, isSessionLoading, fetchKeys]);


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