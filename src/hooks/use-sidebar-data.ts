"use client";

import { useState, useCallback, useEffect } from 'react';
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

export function useSidebarData() {
  const { session, isLoading: isSessionLoading } = useSession();
  const userId = session?.user?.id;

  const [apps, setApps] = useState<UserApp[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]); // New state for notes
  const [isLoading, setIsLoading] = useState(true);

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

    const [appsRes, convRes, folderRes, notesRes] = await Promise.all([
      supabase.from('user_apps').select('id, name, status, url, conversation_id').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('conversations').select('id, title, created_at, folder_id, order_index').eq('user_id', userId).order('order_index', { ascending: true }).order('created_at', { ascending: false }),
      supabase.from('folders').select('id, name, parent_id, created_at, user_id').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('notes').select('id, title, folder_id, created_at, updated_at').eq('user_id', userId).order('updated_at', { ascending: false }) // Fetch notes
    ]);

    const { data: appData, error: appError } = appsRes;
    const { data: convData, error: convError } = convRes;
    const { data: folderData, error: folderError } = folderRes;
    const { data: noteData, error: noteError } = notesRes; // Destructure notes response

    if (appError) {
      console.error('Error fetching apps:', appError);
      toast.error('Error al cargar los proyectos.');
    } else {
      setApps(appData || []);
    }

    if (convError) {
      console.error('Error fetching conversations:', convError);
      toast.error('Error al cargar las conversaciones.');
    } else {
      const appConversationIds = new Set((appData || []).map(app => app.conversation_id));
      setConversations((convData || []).filter(conv => !appConversationIds.has(conv.id)));
    }

    if (folderError) {
      console.error('Error fetching folders:', folderError);
      toast.error('Error al cargar las carpetas.');
    } else {
      setFolders(folderData || []);
    }

    if (noteError) {
      console.error('Error fetching notes:', noteError);
      toast.error('Error al cargar las notas.');
    } else {
      setNotes(noteData || []);
    }

    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchData();
    } else if (!isSessionLoading) {
      setApps([]);
      setConversations([]);
      setFolders([]);
      setNotes([]);
      setIsLoading(false);
    }
  }, [userId, isSessionLoading, fetchData]);

  const createConversation = async (onSuccess: (newConversation: Conversation) => void) => {
    if (!userId) return null;
    const { data, error } = await supabase.from('conversations').insert({ user_id: userId, title: 'Nueva conversación' }).select().single();
    if (error) {
      toast.error('Error al crear una nueva conversación.');
      return null;
    }
    toast.success('Nueva conversación creada.');
    await fetchData();
    onSuccess(data);
    return data;
  };

  const createFolder = async (parentId: string | null = null) => {
    if (!userId) return null;
    const newFolderName = parentId ? 'Nueva subcarpeta' : 'Nueva carpeta';
    const { data, error } = await supabase.from('folders').insert({ user_id: userId, name: newFolderName, parent_id: parentId }).select().single();
    if (error) {
      toast.error('Error al crear una nueva carpeta.');
    } else {
      toast.success(`${newFolderName} creada.`);
      await fetchData();
    }
    return data;
  };

  // New function to create a note
  const createNote = async (onSuccess: (newNote: Note) => void) => {
    if (!userId) return null;
    const { data, error } = await supabase.from('notes').insert({ user_id: userId, title: 'Nueva nota' }).select().single();
    if (error) {
      toast.error('Error al crear una nueva nota.');
      return null;
    }
    toast.success('Nueva nota creada.');
    await fetchData();
    onSuccess(data);
    return data;
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
  };
}