"use server";

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Message } from '@/types/chat';

// Helper para obtener un cliente de Supabase para Server Actions
function getSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

export const fetchConversationDetails = async (convId: string, userId: string) => {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from('conversations').select('id, title, model').eq('id', convId).eq('user_id', userId).single();
  if (error) {
    console.error('Error fetching conversation details:', error);
    throw new Error('Error al cargar los detalles de la conversación.');
  }
  return data;
};

export const fetchMessages = async (convId: string, userId: string): Promise<Message[]> => {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', convId).eq('user_id', userId).order('created_at', { ascending: true });
  if (error) {
    console.error('Error fetching messages:', error);
    throw new Error('Error al cargar los mensajes.');
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
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from('conversations').insert({ user_id: userId, title: 'Nueva conversación', model: selectedModel }).select('id, title').single();
  if (error) {
    console.error('Error creating new conversation:', error);
    throw new Error('Error al crear una nueva conversación.');
  }
  return data;
};

export const updateConversationModel = async (convId: string, userId: string, model: string) => {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from('conversations').update({ model }).eq('id', convId).eq('user_id', userId);
  if (error) {
    console.error('Error updating conversation model:', error);
    throw new Error('Error al actualizar el modelo de la conversación.');
  }
};

export const saveMessage = async (convId: string, userId: string, msg: Omit<Message, 'timestamp' | 'id'>) => {
  const supabase = getSupabaseServerClient();
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
    console.error('Error saving message:', error);
    throw new Error('Error al guardar el mensaje.');
  }
  return { id: data.id, timestamp: new Date(data.created_at) };
};

export const clearMessages = async (convId: string, userId: string) => {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', convId)
        .eq('user_id', userId);
    if (error) {
      console.error('Error clearing messages:', error);
      throw new Error(error.message);
    }
};