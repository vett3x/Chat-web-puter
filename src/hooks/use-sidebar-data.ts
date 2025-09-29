"use client";

import { useState, useCallback, useEffect, useRef } from 'react'; // Import useRef
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/session-context-provider';
import { toast } from 'sonner';

// Define types for our data
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

// New type for Note
interface Note {
  id: string;
  title: string;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

const POLLING_INTERVAL = 30000; // 30 segundos

export function useSidebarData() {
  const { session, isLoading: isSessionLoading } = useSession();
  const userId = session?.user?.id;

  const [apps, setApps] = useState<UserApp[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]); // New state for notes
  const [isLoading, setIsLoading] = useState(true);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for debounce

  const fetchData = useCallback(async () => {
    if (!userId) {
      setApps([]);
      setConversations([]);
      setFolders([]);
      setNotes([]); // Clear notes
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [appsRes, convRes, folderRes, notesRes] = await Promise.all([
        supabase.from('user_apps').select('id, name, status, url, conversation_id').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('conversations').select('id, title, created_at, folder_id, order_index').eq('user_id', userId).order('order_index', { ascending: true }).order('created_at', { ascending: false }),
        supabase.from('folders').select('id, name, parent_id, created_at, user_id').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('notes').select('id, title, folder_id, created_at, updated_at').eq('user_id', userId).order('updated_at', { ascending: false }) // Fetch notes
      ]);

      const { data: appData, error: appError } = appsRes;
      const { data: convData, error: convError } = convRes; // Corrected from folderRes to convRes
      const { data: folderData, error: folderError } = folderRes;
      const { data: noteData, error: noteError } = notesRes; // Destructure notes response

      if (appError) {
        console.error('Error fetching apps:', appError);
        // toast.error('Error al cargar los proyectos.'); // Avoid spamming toasts on background errors
      } else {
        setApps(appData || []);
      }

      if (convError) {
        console.error('Error fetching conversations:', convError);
        // toast.error('Error al cargar las conversaciones.');
      } else {
        const appConversationIds = new Set((appData || []).map(app => app.conversation_id));
        setConversations((convData || []).filter(conv => !appConversationIds.has(conv.id)));
      }

      if (folderError) {
        console.error('Error fetching folders:', folderError);
        // toast.error('Error al cargar las carpetas.');
      } else {
        setFolders(folderData || []);
      }

      if (noteError) {
        console.error('Error fetching notes:', noteError);
        // toast.error('Error al cargar las notas.');
      } else {
        setNotes(noteData || []);
      }
    } catch (error) {
      console.error("A critical error occurred while fetching sidebar data:", error);
      // toast.error("Ocurrió un error crítico al recargar la barra lateral."); // Avoid spamming toasts
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Debounced version of fetchData
  const debouncedFetchData = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      fetchData();
    }, 300); // 300ms debounce
  }, [fetchData]);

  useEffect(() => {
    if (userId) {
      debouncedFetchData(); // Initial fetch
      const interval = setInterval(() => {
        if (document.visibilityState === 'visible') { // Only poll when tab is visible
          debouncedFetchData();
        }
      }, POLLING_INTERVAL);
      return () => clearInterval(interval);
    } else if (!isSessionLoading) {
      setApps([]);
      setConversations([]);
      setFolders([]);
      setNotes([]);
      setIsLoading(false);
    }
  }, [userId, isSessionLoading, debouncedFetchData]);

  const createConversation = async (onSuccess: (newConversation: Conversation) => void): Promise<string | null> => {
    if (!userId) {
      toast.error('Usuario no autenticado.');
      return null;
    }
    // REMOVED: user_id from insert payload. DB will handle it.
    const { data, error } = await supabase.from('conversations').insert({ title: 'Nueva conversación' }).select().single();
    if (error) {
      toast.error('Error al crear una nueva conversación.');
      console.error('Supabase Error creating conversation:', error);
      throw new Error(error.message); // Throw error for catch block in component
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
    // REMOVED: user_id from insert payload. DB will handle it.
    const { data, error } = await supabase.from('folders').insert({ name: newFolderName, parent_id: parentId }).select().single();
    if (error) {
      toast.error('Error al crear una nueva carpeta.');
      console.error('Supabase Error creating folder:', error);
      throw new Error(error.message); // Throw error for catch block in component
    }
    toast.success(`${newFolderName} creada.`);
    setFolders(prev => [data, ...prev]); // Optimistic update
    return data.id;
  };

  // New function to create a note
  const createNote = async (onSuccess: (newNote: Note) => void): Promise<string | null> => {
    if (!userId) {
      toast.error('Usuario no autenticado.');
      return null;
    }
    // REMOVED: user_id from insert payload. DB will handle it.
    const { data, error } = await supabase.from('notes').insert({ title: 'Nueva nota' }).select().single();
    if (error) {
      toast.error('Error al crear una nueva nota.');
      console.error('Supabase Error creating note:', error);
      throw new Error(error.message); // Throw error for catch block in component
    }
    toast.success('Nueva nota creada.');
    setNotes(prev => [data, ...prev]); // Optimistic update
    onSuccess(data);
    return data.id;
  };

  // Functions for moving items (conversations, notes, folders)
  const moveItem = async (itemId: string, itemType: 'conversation' | 'note' | 'folder', targetFolderId: string | null) => {
    if (!userId) return;

    let tableName: 'conversations' | 'notes' | 'folders' = 'conversations';
    let updateField = 'folder_id';
    if (itemType === 'note') tableName = 'notes';
    if (itemType === 'folder') {
      tableName = 'folders';
      updateField = 'parent_id';
      // Prevent moving a folder into itself or its descendants
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

    const { error } = await supabase.from(tableName).update({ [updateField]: targetFolderId }).eq('id', itemId).eq('user_id', userId);
    if (error) {
      toast.error(`Error al mover el elemento.`);
    } else {
      toast.success(`Elemento movido.`);
      await fetchData();
    }
  };

  // NEW: Functions to update local state without full refresh
  const updateLocalItem = (itemId: string, itemType: 'conversation' | 'note' | 'folder', updatedData: Partial<Conversation | Note | Folder>) => {
    switch (itemType) {
      case 'conversation':
        setConversations(prev => prev.map(c => c.id === itemId ? { ...c, ...updatedData } : c));
        break;
      case 'note':
        setNotes(prev => prev.map(n => n.id === itemId ? { ...n, ...updatedData } : n));
        break;
      case 'folder':
        setFolders(prev => prev.map(f => f.id === itemId ? { ...f, ...updatedData } : f));
        break;
    }
  };

  const removeLocalItem = (itemId: string, itemType: 'conversation' | 'note' | 'folder') => {
    switch (itemType) {
      case 'conversation':
        setConversations(prev => prev.filter(c => c.id !== itemId));
        break;
      case 'note':
        setNotes(prev => prev.filter(n => n.id !== itemId));
        break;
      case 'folder':
        setFolders(prev => prev.filter(f => f.id !== itemId));
        break;
    }
  };

  return {
    apps,
    conversations,
    folders,
    notes,
    isLoading,
    fetchData: debouncedFetchData, // Expose debounced version
    createConversation,
    createFolder,
    createNote,
    moveItem,
    updateLocalItem,
    removeLocalItem,
  };
}