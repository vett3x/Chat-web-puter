-- Crear la nueva tabla para almacenar las versiones completas del proyecto
CREATE TABLE public.app_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    app_id UUID NOT NULL REFERENCES public.user_apps(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    db_schema_dump TEXT,
    db_data_dump TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS para la nueva tabla
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para que los usuarios solo puedan gestionar sus propias versiones
CREATE POLICY "Users can manage their own app versions" ON public.app_versions
    FOR ALL USING (auth.uid() = user_id);

-- Añadir la columna 'version_id' a la tabla de backups de archivos
ALTER TABLE public.app_file_backups
    ADD COLUMN version_id UUID REFERENCES public.app_versions(id) ON DELETE CASCADE;

-- Crear un índice para mejorar el rendimiento de las consultas
CREATE INDEX idx_app_file_backups_version_id ON public.app_file_backups(version_id);