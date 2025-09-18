-- Crear la tabla public.folders para organizar las conversaciones en carpetas
CREATE TABLE public.folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.folders(id) ON DELETE SET NULL, -- Para subcarpetas, puede ser nulo si es una carpeta raíz
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Seguridad a Nivel de Fila) para la tabla folders
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para la tabla folders:
-- Permitir a los usuarios ver solo sus propias carpetas
CREATE POLICY "Folders can only be viewed by their owner" ON public.folders
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Permitir a los usuarios crear solo sus propias carpetas
CREATE POLICY "Folders can only be created by their owner" ON public.folders
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Permitir a los usuarios actualizar solo sus propias carpetas
CREATE POLICY "Folders can only be updated by their owner" ON public.folders
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Permitir a los usuarios eliminar solo sus propias carpetas
CREATE POLICY "Folders can only be deleted by their owner" ON public.folders
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Añadir la columna folder_id a la tabla public.conversations
-- Esta columna vinculará las conversaciones a una carpeta. Si la carpeta se elimina,
-- el folder_id de las conversaciones asociadas se establecerá en NULL.
ALTER TABLE public.conversations
ADD COLUMN folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL;

-- Las políticas RLS existentes para 'conversations' ya deberían manejar la propiedad
-- por user_id, por lo que no se necesitan cambios adicionales en esas políticas
-- para la nueva columna folder_id, ya que la referencia es a una tabla que también
-- tiene RLS basado en user_id.