-- 1. Habilitar RLS en la tabla user_servers
ALTER TABLE public.user_servers ENABLE ROW LEVEL SECURITY;

-- 2. Crear política para permitir a los usuarios leer sus propios servidores
CREATE POLICY "Allow users to read their own servers"
ON public.user_servers
FOR SELECT
USING (auth.uid() = user_id);

-- 3. Crear política para permitir a los usuarios insertar sus propios servidores
CREATE POLICY "Allow users to insert their own servers"
ON public.user_servers
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 4. Crear política para permitir a los usuarios actualizar sus propios servidores
CREATE POLICY "Allow users to update their own servers"
ON public.user_servers
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Crear política para permitir a los usuarios eliminar sus propios servidores
CREATE POLICY "Allow users to delete their own servers"
ON public.user_servers
FOR DELETE
USING (auth.uid() = user_id);