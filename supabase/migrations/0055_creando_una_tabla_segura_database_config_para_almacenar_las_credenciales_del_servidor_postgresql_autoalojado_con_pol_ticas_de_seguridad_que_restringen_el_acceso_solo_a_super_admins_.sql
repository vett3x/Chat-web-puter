-- Crear la tabla para la configuración de la base de datos
CREATE TABLE public.database_config (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000', -- Fixed ID to ensure only one row
  db_host TEXT NOT NULL,
  db_port INTEGER NOT NULL,
  db_name TEXT NOT NULL,
  db_user TEXT NOT NULL,
  db_password TEXT NOT NULL, -- This will be encrypted
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.database_config ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS: Solo los Super Admins pueden ver y modificar la configuración.
CREATE POLICY "Super Admins can manage database config" ON public.database_config
FOR ALL
TO authenticated
USING (get_user_role(auth.uid()) = 'super_admin')
WITH CHECK (get_user_role(auth.uid()) = 'super_admin');