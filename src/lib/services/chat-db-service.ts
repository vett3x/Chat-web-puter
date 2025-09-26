"use server";

import { createServerClient, type CookieOptions, type CookieMethodsServer } from '@supabase/ssr';
import { cookies, type ReadonlyRequestCookies, type Cookie } from 'next/headers'; // Importar ReadonlyRequestCookies y Cookie
import { Message } from '@/types/chat';

// Helper para obtener un cliente de Supabase para Server Actions
async function getSupabaseServerClient() {
  const cookieStore: ReadonlyRequestCookies = cookies(); // Obtener la instancia de ReadonlyRequestCookies

  const cookieMethods: CookieMethodsServer = {
    get(name: string): string | undefined {
      // Acceder al valor de la cookie, que es un string o undefined
      return cookieStore.get(name)?.value;
    },
    getAll(): { name: string; value: string }[] {
      // Mapear Cookie[] a { name: string, value: string }[]
      return cookieStore.getAll().map((cookie: Cookie) => ({
        name: cookie.name,
        value: cookie.value,
      }));
    },
    set(name: string, value: string, options: CookieOptions): void {
      // En Server Actions, no se suelen establecer cookies de respuesta directamente de esta manera.
      // Supabase maneja la configuración de cookies de autenticación implícitamente.
      // Esta función es requerida por la interfaz, pero puede ser una operación nula aquí.
    },
    remove(name: string, options: CookieOptions): void {
      // Similar a 'set', la eliminación directa de cookies de respuesta no es típica en Server Actions.
      // Operación nula aquí.
    },
  };

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: cookieMethods
    }
  );
}

export const fetchConversationDetails = async (convId: string, userId: string) => {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.from('conversations').select('id, title, model').eq('id', convId).eq('user_id', userId).single();
  if (error) {
    console.error('Error fetching conversation details:', error);
    throw new Error('Error al cargar los detalles de la conversación.');
  }
  return data;
};

export const fetchMessages = async (convId: string, userId: string): Promise<Message[]> => {
  const supabase = await getSupabaseServerClient();
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
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.from('conversations').insert({ user_id: userId, title: 'Nueva conversación', model: selectedModel }).select('id, title').single();
  if (error) {
    console.error('Error creating new conversation:', error);
    throw new Error('Error al crear una nueva conversación.');
  }
  return data;
};

export const updateConversationModel = async (convId: string, userId: string, model: string) => {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from('conversations').update({ model }).eq('id', convId).eq('user_id', userId);
  if (error) {
    console.error('Error updating conversation model:', error);
    throw new Error('Error al actualizar el modelo de la conversación.');
  }
};

export const saveMessage = async (convId: string, userId: string, msg: Omit<Message, 'timestamp' | 'id'>) => {
  const supabase = await getSupabaseServerClient();
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
    const supabase = await getSupabaseServerClient();
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