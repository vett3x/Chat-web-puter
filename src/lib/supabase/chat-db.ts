"use server";

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Message } from '@/types/chat';

export async function fetchConversationDetails(convId: string, userId: string) {
  const { data, error } = await supabase.from('conversations').select('id, title, model').eq('id', convId).eq('user_id', userId).single();
  if (error) {
    console.error('Error fetching conversation details:', error);
    toast.error('Error al cargar los detalles de la conversación.');
    return null;
  }
  return data;
}

export async function fetchMessages(convId: string, userId: string): Promise<Message[]> {
  const { data, error } = await supabase.from('messages').select('id, content, role, model, created_at, conversation_id, type').eq('conversation_id', convId).eq('user_id', userId).order('created_at', { ascending: true });
  if (error) {
    console.error('Error fetching messages:', error);
    toast.error('Error al cargar los mensajes.');
    return [];
  }
  return data.map((msg: any) => ({
    id: msg.id,
    conversation_id: msg.conversation_id,
    content: msg.content,
    role: msg.role,
    model: msg.model || undefined,
    timestamp: new Date(msg.created_at),
    type: msg.type,
  }));
}

export async function createConversationInDB(userId: string, selectedModel: string) {
  const { data, error } = await supabase.from('conversations').insert({ user_id: userId, title: 'Nueva conversación', model: selectedModel }).select('id, title').single();
  if (error) {
    toast.error('Error al crear una nueva conversación.');
    return null;
  }
  return data;
}

export async function updateConversationModelInDB(convId: string, userId: string, model: string) {
  const { error } = await supabase.from('conversations').update({ model }).eq('id', convId).eq('user_id', userId);
  if (error) toast.error('Error al actualizar el modelo de la conversación.');
}

export async function saveMessageToDB(convId: string, userId: string, msg: Omit<Message, 'timestamp' | 'id'>) {
  const { data, error } = await supabase.from('messages').insert({ conversation_id: convId, user_id: userId, role: msg.role, content: msg.content as any, model: msg.model, type: msg.type }).select('id, created_at').single();
  if (error) {
    toast.error('Error al guardar el mensaje.');
    return null;
  }
  return { id: data.id, timestamp: new Date(data.created_at) };
}

export async function clearChatInDB(convId: string, userId: string) {
  const { error } = await supabase.from('messages').delete().eq('conversation_id', convId).eq('user_id', userId);
  if (error) {
    throw new Error(error.message);
  }
}