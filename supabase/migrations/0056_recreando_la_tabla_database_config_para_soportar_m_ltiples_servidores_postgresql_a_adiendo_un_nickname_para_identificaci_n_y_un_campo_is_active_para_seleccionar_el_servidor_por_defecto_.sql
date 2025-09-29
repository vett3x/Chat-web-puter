-- Drop the old table first to change its structure
DROP TABLE IF EXISTS public.database_config;

-- Create the new table to support multiple database configurations
CREATE TABLE public.database_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  db_host TEXT NOT NULL,
  db_port INTEGER NOT NULL,
  db_name TEXT NOT NULL,
  db_user TEXT NOT NULL,
  db_password TEXT NOT NULL, -- This will be encrypted
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.database_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only Super Admins can manage the configurations.
CREATE POLICY "Super Admins can manage database config" ON public.database_config
FOR ALL
TO authenticated
USING (get_user_role(auth.uid()) = 'super_admin')
WITH CHECK (get_user_role(auth.uid()) = 'super_admin');