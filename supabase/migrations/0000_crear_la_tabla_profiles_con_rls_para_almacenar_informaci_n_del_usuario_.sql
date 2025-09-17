-- Crear la tabla public.profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Habilitar RLS (REQUERIDO para seguridad)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Crear políticas de seguridad para cada operación
CREATE POLICY "profiles_select_policy" ON public.profiles 
FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "profiles_insert_policy" ON public.profiles 
FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_policy" ON public.profiles 
FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "profiles_delete_policy" ON public.profiles 
FOR DELETE TO authenticated USING (auth.uid() = id);