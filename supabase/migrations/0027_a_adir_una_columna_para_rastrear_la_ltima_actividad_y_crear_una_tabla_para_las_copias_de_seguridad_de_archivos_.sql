-- Añadir columna para rastrear la última vez que se usó una app
ALTER TABLE public.user_apps
ADD COLUMN last_activity_at TIMESTAMPTZ DEFAULT NOW();

-- Crear una nueva tabla para almacenar las copias de seguridad de los archivos de la app
CREATE TABLE public.app_file_backups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    app_id UUID NOT NULL REFERENCES public.user_apps(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    UNIQUE (app_id, file_path)
);

-- Habilitar RLS para la nueva tabla (¡MUY IMPORTANTE!)
ALTER TABLE public.app_file_backups ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para que los usuarios solo puedan gestionar sus propias copias de seguridad
CREATE POLICY "Users can manage their own file backups"
ON public.app_file_backups
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);