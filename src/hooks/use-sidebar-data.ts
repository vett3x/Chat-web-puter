"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/session-context-provider';
import { toast } from 'sonner';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  folder_id: string | null;
  order_index: number;
}

interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  user_id: string;
}

interface UserApp {
  id: string;
  name: string;
  status: string;
  url: string | null;
  conversation_id: string | null;
}

interface Note {
  id: string;
  title: string;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useSidebarData() {
  const { session, isLoading: isSessionLoading, userDefaultModel, globalRefreshKey } = useSession();
  const userId = session?.user?.id;

  const [apps, setApps] = useState<UserApp[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isInitialFetch = useRef(true);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setApps([]);
      setConversations([]);
      setFolders([]);
      setNotes([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [appsRes, convRes, folderRes, notesRes] = await Promise.all([
        supabase.from('user_apps').select('id, name, status, url, conversation_id').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('conversations').select('id, title, created_at, folder_id, order_index').eq('user_id', userId).order('order_index', { ascending: true }).order('created_at', { ascending: false }),
        supabase.from('folders').select('id, name, parent_id, created_at, user_id').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('notes').select('id, title, folder_id, created_at, updated_at').eq('user_id', userId).order('updated_at', { ascending: false })
      ]);

      if (appsRes.error) throw appsRes.error;
      if (convRes.error) throw convRes.error;
      if (folderRes.error) throw folderRes.error;
      if (notesRes.error) throw notesRes.error;

      const appConversationIds = new Set((appsRes.data || []).map(app => app.conversation_id));
      setApps(appsRes.data || []);
      setConversations((convRes.data || []).filter(conv => !appConversationIds.has(conv.id)));
      setFolders(folderRes.data || []);
      setNotes(notesRes.data || []);

    } catch (error: any) {
      console.error("Error fetching sidebar data:", error);
      if (!isInitialFetch.current) {
        toast.error("Error al cargar los datos de la barra lateral.");
      }
    } finally {
      setIsLoading(false);
      isInitialFetch.current = false;
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchData();
    } else if (!isSessionLoading) {
      setIsLoading(false);
      setApps([]);
      setConversations([]);
      setFolders([]);
      setNotes([]);
    }
  }, [userId, isSessionLoading, fetchData, globalRefreshKey]);

  useEffect(() => {
    if (!userId) return;

    const handleInserts = <T extends { id: string }>(payload: any, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
      setter(prev => {
        if (prev.some(item => item.id === payload.new.id)) {
          return prev;
        }
        return [payload.new as T, ...prev];
      });
    };
    const handleUpdates = <T extends { id: string }>(payload: any, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
      setter(prev => prev.map(item => item.id === payload.new.id ? { ...item, ...payload.new } : item));
    };
    const handleDeletes = <T extends { id: string }>(payload: any, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
      const oldId = payload.old?.id;
      if (oldId) {
        setter(prev => prev.filter(item => item.id !== oldId));
      } else {
        fetchData();
      }
    };

    const channel = supabase.channel(`sidebar-updates-for-user-${userId}`);

    const tablesToSubscribe = [
      { table: 'user_apps', setter: setApps },
      { table: 'conversations', setter: setConversations },
      { table: 'folders', setter: setFolders },
      { table: 'notes', setter: setNotes },
    ];

    tablesToSubscribe.forEach(({ table, setter }) => {
      channel
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table, filter: `user_id=eq.${userId}` },
          (payload) => handleInserts(payload, setter as any)
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table, filter: `user_id=eq.${userId}` },
          (payload) => handleUpdates(payload, setter as any)
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table, filter: `user_id=eq.${userId}` },
          (payload) => handleDeletes(payload, setter as any)
        );
    });

    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('Subscribed to sidebar updates channel!');
      }
      if (status === 'CHANNEL_ERROR') {
        console.error('Sidebar updates channel error:', err);
        toast.error('Error de conexión en tiempo real. La barra lateral puede no actualizarse.');
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchData]);

  const createConversation = async (onSuccess: (newConversation: Conversation) => void): Promise<string | null> => {
    if (!userId) {
      toast.error('Usuario no autenticado.');
      return null;
    }
    const { data, error } = await supabase.from('conversations').insert({ title: 'Nueva conversación', model: userDefaultModel }).select().single();
    if (error) {
      toast.error('Error al crear una nueva conversación.');
      throw new Error(error.message);
    }
    toast.success('Nueva conversación creada.');
    setConversations(prev => [data, ...prev]);
    onSuccess(data);
    return data.id;
  };

  const createFolder = async (parentId: string | null = null): Promise<string | null> => {
    if (!userId) {
      toast.error('Usuario no autenticado.');
      return null;
    }
    const newFolderName = parentId ? 'Nueva subcarpeta' : 'Nueva carpeta';
    const { data, error } = await supabase.from('folders').insert({ name: newFolderName, parent_id: parentId }).select().single();
    if (error) {
      toast.error('Error al crear una nueva carpeta.');
      throw new Error(error.message);
    }
    toast.success(`${newFolderName} creada.`);
    setFolders(prev => [data, ...prev]);
    return data.id;
  };

  const createNote = async (onSuccess: (newNote: Note) => void): Promise<string | null> => {
    if (!userId) {
      toast.error('Usuario no autenticado.');
      return null;
    }
    const { data, error } = await supabase.from('notes').insert({ title: 'Nueva nota' }).select().single();
    if (error) {
      toast.error('Error al crear una nueva nota.');
      throw new Error(error.message);
    }
    toast.success('Nueva nota creada.');
    setNotes(prev => [data, ...prev]);
    onSuccess(data);
    return data.id;
  };

  const moveItem = async (itemId: string, itemType: 'conversation' | 'note' | 'folder', targetFolderId: string | null) => {
    if (!userId) return;
    let tableName: 'conversations' | 'notes' | 'folders' = 'conversations';
    let updateField = 'folder_id';
    if (itemType === 'note') tableName = 'notes';
    if (itemType === 'folder') {
      tableName = 'folders';
      updateField = 'parent_id';
      let currentParentId = targetFolderId;
      while (currentParentId) {
        if (currentParentId === itemId) {
          toast.error('No puedes mover una carpeta a una de sus subcarpetas.');
          return;
        }
        const parentFolder = folders.find(f => f.id === currentParentId);
        currentParentId = parentFolder ? parentFolder.parent_id : null;
      }
    }
    const { error } = await supabase.from(tableName).update({ [updateField]: targetFolderId }).eq('id', itemId);
    if (error) {
      toast.error(`Error al mover el elemento.`);
    } else {
      toast.success(`Elemento movido.`);
      fetchData();
    }
  };

  const updateLocalItem = (itemId: string, itemType: 'conversation' | 'note' | 'folder', updatedData: Partial<Conversation | Note | Folder>) => {
    const setterMap = {
      conversation: setConversations,
      note: setNotes,
      folder: setFolders,
    };
    const setter = setterMap[itemType] as React.Dispatch<React.SetStateAction<any[]>>;
    setter(prev => prev.map(item => item.id === itemId ? { ...item, ...updatedData } : item));
  };

  const removeLocalItem = (itemId: string, itemType: 'conversation' | 'note' | 'folder') => {
    const setterMap = {
      conversation: setConversations,
      note: setNotes,
      folder: setFolders,
    };
    const setter = setterMap[itemType] as React.Dispatch<React.SetStateAction<any[]>>;
    setter(prev => prev.filter(item => item.id !== itemId));
  };

  return {
    apps,
    conversations,
    folders,
    notes,
    isLoading,
    fetchData,
    createConversation,
    createFolder,
    createNote,
    moveItem,
    updateLocalItem,
    removeLocalItem,
  };
}