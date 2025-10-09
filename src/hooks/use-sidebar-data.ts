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

  const fetchData = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/sidebar-data');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al cargar los datos.');
      }
      const { apps, conversations, folders, notes } = await response.json();
      setApps(apps);
      setConversations(conversations);
      setFolders(folders);
      setNotes(notes);
    } catch (error: any) {
      console.error("Error fetching sidebar data via API:", error);
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchData();
    } else if (!isSessionLoading) {
      // Clear data if no user
      setApps([]);
      setConversations([]);
      setFolders([]);
      setNotes([]);
      setIsLoading(false);
    }
  }, [userId, isSessionLoading, fetchData, globalRefreshKey]);

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
    setConversations(prev => [data, ...prev]); // Optimistic update
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
    setFolders(prev => [data, ...prev]); // Optimistic update
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
    setNotes(prev => [data, ...prev]); // Optimistic update
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