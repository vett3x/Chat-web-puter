-- Crear la tabla public.conversations
CREATE TABLE public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Nueva conversación',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (REQUERIDO para seguridad)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Crear políticas de seguridad para cada operación
CREATE POLICY "conversations_select_policy" ON public.conversations 
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "conversations_insert_policy" ON public.conversations 
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "conversations_update_policy" ON public.conversations 
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "conversations_delete_policy" ON public.conversations 
FOR DELETE TO authenticated USING (auth.uid() = user_id);