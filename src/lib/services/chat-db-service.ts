"use server";

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Message } from '@/types/chat';

export const fetchConversationDetails = async (convId: string, userId: string) => {
  const { data, error } = await supabase.from('conversations').select('id, title, model').eq('id', convId).eq('user_id', userId).single();
  if (error) {
    console.error('Error fetching conversation details:', error);
    toast.error('Error al cargar los detalles de la conversación.');
    return null;
  }
  return data;
};

export const fetchMessages = async (convId: string, userId: string): Promise<Message[]> => {
  const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', convId).eq('user_id', userId).order('created_at', { ascending: true });
  if (error) {
    console.error('Error fetching messages:', error);
    toast.error('Error al cargar los mensajes.');
    return [];
  }
  return data.map((msg: any) => ({
    ...msg,
    timestamp: new Date(msg.created_at),
    isConstructionPlan: typeof msg.content === 'string' && msg.content.includes('### 1. Análisis del Requerimiento'),
    planApproved: false,
    isCorrectionPlan: false,
    correctionApproved: false,
    isNew: false,
    isTyping: false,
    isAnimated: true,
  }));
};

export const createConversation = async (userId: string, selectedModel: string) => {
  const { data, error } = await supabase.from('conversations').insert({ user_id: userId, title: 'Nueva conversación', model: selectedModel }).select('id, title').single();
  if (error) {
    toast.error('Error al crear una nueva conversación.');
    return null;
  }
  return data;
};

export const updateConversationModel = async (convId: string, userId: string, model: string) => {
  const { error } = await supabase.from('conversations').update({ model }).eq('id', convId).eq('user_id', userId);
  if (error) toast.error('Error al actualizar el modelo de la conversación.');
};

export const saveMessage = async (convId: string, userId: string, msg: Omit<Message, 'timestamp' | 'id'>) => {
  const { data, error } = await supabase.from('messages').insert({
    conversation_id: convId,
    user_id: userId,
    role: msg.role,
    content: msg.content as any,
    model: msg.model,
    type: msg.type,
    is_construction_plan: msg.isConstructionPlan,
    plan_approved: msg.planApproved,
    is_correction_plan: msg.isCorrectionPlan,
    correction_approved: msg.correctionApproved,
  }).select('id, created_at').single();

  if (error) {
    toast.error('Error al guardar el mensaje.');
    return null;
  }
  return { id: data.id, timestamp: new Date(data.created_at) };
};

export const clearMessages = async (convId: string, userId: string) => {
    const { error } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', convId)
        .eq('user_id', userId);
    if (error) throw new Error(error.message);
};