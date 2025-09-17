-- Crear la tabla public.messages
CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL, -- 'user' o 'assistant'
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text', -- 'text' o 'code'
  model TEXT, -- Modelo de IA utilizado
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (REQUERIDO para seguridad)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Crear políticas de seguridad para cada operación
CREATE POLICY "messages_select_policy" ON public.messages 
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "messages_insert_policy" ON public.messages 
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "messages_update_policy" ON public.messages 
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "messages_delete_policy" ON public.messages 
FOR DELETE TO authenticated USING (auth.uid() = user_id);