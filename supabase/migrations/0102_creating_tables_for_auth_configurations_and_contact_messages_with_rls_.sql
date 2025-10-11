-- Create table for auth provider configurations
CREATE TABLE public.auth_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE,
  client_id TEXT,
  client_secret TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.auth_configs ENABLE ROW LEVEL SECURITY;

-- Policies for auth_configs (only super admins can manage)
CREATE POLICY "auth_configs_super_admin_all_access" ON public.auth_configs
FOR ALL TO authenticated
USING (get_user_role(auth.uid()) = 'super_admin'::text)
WITH CHECK (get_user_role(auth.uid()) = 'super_admin'::text);

-- Create table for contact form messages
CREATE TABLE public.contact_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Policies for contact_messages
CREATE POLICY "contact_messages_public_insert" ON public.contact_messages
FOR INSERT WITH CHECK (true);

CREATE POLICY "contact_messages_admin_access" ON public.contact_messages
FOR ALL TO authenticated
USING (get_user_role(auth.uid()) IN ('admin', 'super_admin'));