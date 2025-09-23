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

export function useConversations() {
  const { session, isLoading: isSessionLoading } = useSession();
  const userId = session?.user?.id;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setConversations([]);
      setFolders([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data: convData, error: convError } = await supabase
      .from('conversations')
      .select('id, title, created_at, folder_id, order_index')
      .eq('user_id', userId)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: false });

    const { data: folderData, error: folderError } = await supabase
      .from('folders')
      .select('id, name, parent_id, created_at, user_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (convError) {
      console.error('Error fetching conversations:', convError);
      toast.error('Error al cargar las conversaciones.');
    } else {
      setConversations(convData || []);
    }

    if (folderError) {
      console.error('Error fetching folders:', folderError);
      toast.error('Error al cargar las carpetas.');
    } else {
      setFolders(folderData || []);
    }
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchData();
    } else if (!isSessionLoading) {
      setConversations([]);
      setFolders([]);
      setIsLoading(false);
    }
  }, [userId, isSessionLoading, fetchData]);

  const createConversation = async (onSuccess: (newConversation: Conversation) => void) => {
    if (!userId) return null;

    const generalConvs = conversations.filter(c => c.folder_id === null);
    const maxOrderIndex = generalConvs.length > 0
      ? Math.max(...generalConvs.map(c => c.order_index))
      : 0;
    const newOrderIndex = maxOrderIndex + 1;

    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: userId, title: 'Nueva conversación', folder_id: null, order_index: newOrderIndex })
      .select('id, title, created_at, folder_id, order_index')
      .single();

    if (error) {
      console.error('Error creating new conversation:', error);
      toast.error('Error al crear una nueva conversación.');
      return null;
    }
    
    toast.success('Nueva conversación creada.');
    await fetchData();
    if (data) {
        onSuccess(data);
    }
    return data;
  };

  const createFolder = async (parentId: string | null = null) => {
    if (!userId) return null;

    const newFolderName = parentId ? 'Nueva subcarpeta' : 'Nueva carpeta';
    const { data, error } = await supabase
      .from('folders')
      .insert({ user_id: userId, name: newFolderName, parent_id: parentId })
      .select('id, name, parent_id, created_at, user_id')
      .single();

    if (error) {
      console.error('Error creating new folder:', error);
      toast.error('Error al crear una nueva carpeta.');
    } else {
      toast.success(`${newFolderName} creada.`);
      await fetchData();
    }
    return data;
  };

  const moveConversation = async (conversationId: string, targetFolderId: string | null) => {
    if (!userId) return;

    const targetConversations = conversations.filter(c => c.folder_id === targetFolderId);
    const maxOrderIndex = targetConversations.length > 0
      ? Math.max(...targetConversations.map(c => c.order_index))
      : 0;
    const newOrderIndex = maxOrderIndex + 1;

    const { error } = await supabase
      .from('conversations')
      .update({ folder_id: targetFolderId, order_index: newOrderIndex })
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error moving conversation:', error);
      toast.error('Error al mover la conversación.');
    } else {
      toast.success('Conversación movida.');
      await fetchData();
    }
  };

  const reorderConversation = async (draggedId: string, targetId: string, position: 'before' | 'after') => {
    if (!userId || draggedId === targetId) return;

    const draggedConv = conversations.find(c => c.id === draggedId);
    const targetConv = conversations.find(c => c.id === targetId);

    if (!draggedConv || !targetConv || draggedConv.folder_id !== targetConv.folder_id) {
      if (draggedConv && targetConv) {
        await moveConversation(draggedId, targetConv.folder_id);
      }
      return;
    }

    const siblingConversations = conversations
      .filter(c => c.folder_id === draggedConv.folder_id)
      .sort((a, b) => a.order_index - b.order_index);

    const targetIndex = siblingConversations.findIndex(c => c.id === targetId);
    const draggedIndex = siblingConversations.findIndex(c => c.id === draggedId);

    if (targetIndex === -1 || draggedIndex === -1) return;

    const [removed] = siblingConversations.splice(draggedIndex, 1);
    const newTargetIndex = position === 'before' ? targetIndex : targetIndex + 1;
    siblingConversations.splice(newTargetIndex > siblingConversations.length ? siblingConversations.length : newTargetIndex, 0, removed);

    const updates = siblingConversations.map((conv, index) => ({
      id: conv.id,
      order_index: (index + 1) * 100,
    }));

    const { error } = await supabase
      .from('conversations')
      .upsert(updates, { onConflict: 'id' });

    if (error) {
      console.error('Error reordering conversations:', error);
      toast.error('Error al reordenar las conversaciones.');
    } else {
      toast.success('Conversación reordenada.');
      await fetchData();
    }
  };

  const moveFolder = async (folderId: string, targetParentId: string | null) => {
    if (!userId) return;

    let currentParentId = targetParentId;
    while (currentParentId) {
      if (currentParentId === folderId) {
        toast.error('No puedes mover una carpeta a una de sus subcarpetas.');
        return;
      }
      const parentFolder = folders.find(f => f.id === currentParentId);
      currentParentId = parentFolder ? parentFolder.parent_id : null;
    }

    const { error } = await supabase
      .from('folders')
      .update({ parent_id: targetParentId })
      .eq('id', folderId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error moving folder:', error);
      toast.error('Error al mover la carpeta.');
    } else {
      toast.success('Carpeta movida.');
      await fetchData();
    }
  };

  return {
    conversations,
    folders,
    isLoading,
    fetchData,
    createConversation,
    createFolder,
    moveConversation,
    reorderConversation,
    moveFolder,
  };
}