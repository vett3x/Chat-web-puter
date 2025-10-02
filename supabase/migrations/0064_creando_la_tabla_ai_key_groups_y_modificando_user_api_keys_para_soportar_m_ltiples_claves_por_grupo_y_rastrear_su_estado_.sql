-- supabase/migrations/0064_create_ai_key_groups_table_and_link_user_api_keys.sql

-- Create ai_key_groups table
CREATE TABLE public.ai_key_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  model_name TEXT, -- Can be null if group is for custom endpoint where model is per key
  is_global BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for ai_key_groups
ALTER TABLE public.ai_key_groups ENABLE ROW LEVEL SECURITY;

-- Policies for ai_key_groups
CREATE POLICY "Users can view their own AI key groups" ON public.ai_key_groups
FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_global = TRUE);

CREATE POLICY "Users can insert their own AI key groups" ON public.ai_key_groups
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR (is_global = TRUE AND get_user_role(auth.uid()) = 'super_admin'));

CREATE POLICY "Users can update their own AI key groups" ON public.ai_key_groups
FOR UPDATE TO authenticated USING (auth.uid() = user_id OR (is_global = TRUE AND get_user_role(auth.uid()) = 'super_admin'));

CREATE POLICY "Users can delete their own AI key groups" ON public.ai_key_groups
FOR DELETE TO authenticated USING (auth.uid() = user_id OR (is_global = TRUE AND get_user_role(auth.uid()) = 'super_admin'));

-- Super Admins can manage all AI key groups
CREATE POLICY "Super Admins can manage all AI key groups" ON public.ai_key_groups
FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'super_admin');


-- Add group_id to user_api_keys
ALTER TABLE public.user_api_keys
ADD COLUMN group_id UUID REFERENCES public.ai_key_groups(id) ON DELETE CASCADE;

-- Add status and status_message to user_api_keys
ALTER TABLE public.user_api_keys
ADD COLUMN status TEXT DEFAULT 'active' NOT NULL,
ADD COLUMN status_message TEXT;

-- Update RLS policies for user_api_keys to consider group_id
-- Drop existing policies to recreate them with group_id consideration
DROP POLICY IF EXISTS "Users can view their own API keys" ON public.user_api_keys;
DROP POLICY IF EXISTS "Users can insert their own API keys" ON public.user_api_keys;
DROP POLICY IF EXISTS "Users can update their own API keys" ON public.user_api_keys;
DROP POLICY IF EXISTS "Users can delete their own API keys" ON public.user_api_keys;

-- Recreate policies for user_api_keys
CREATE POLICY "Users can view their own API keys" ON public.user_api_keys
FOR SELECT TO authenticated USING (
  (auth.uid() = user_id AND is_global = FALSE) OR
  (group_id IN (SELECT id FROM public.ai_key_groups WHERE user_id = auth.uid() OR is_global = TRUE)) OR
  (is_global = TRUE)
);

CREATE POLICY "Users can insert their own API keys" ON public.user_api_keys
FOR INSERT TO authenticated WITH CHECK (
  (auth.uid() = user_id AND is_global = FALSE) OR
  (group_id IN (SELECT id FROM public.ai_key_groups WHERE user_id = auth.uid() AND is_global = FALSE)) OR
  (is_global = TRUE AND get_user_role(auth.uid()) = 'super_admin')
);

CREATE POLICY "Users can update their own API keys" ON public.user_api_keys
FOR UPDATE TO authenticated USING (
  (auth.uid() = user_id AND is_global = FALSE) OR
  (group_id IN (SELECT id FROM public.ai_key_groups WHERE user_id = auth.uid() AND is_global = FALSE)) OR
  (is_global = TRUE AND get_user_role(auth.uid()) = 'super_admin')
) WITH CHECK (
  (auth.uid() = user_id AND is_global = FALSE) OR
  (group_id IN (SELECT id FROM public.ai_key_groups WHERE user_id = auth.uid() AND is_global = FALSE)) OR
  (is_global = TRUE AND get_user_role(auth.uid()) = 'super_admin')
);

CREATE POLICY "Users can delete their own API keys" ON public.user_api_keys
FOR DELETE TO authenticated USING (
  (auth.uid() = user_id AND is_global = FALSE) OR
  (group_id IN (SELECT id FROM public.ai_key_groups WHERE user_id = auth.uid() AND is_global = FALSE)) OR
  (is_global = TRUE AND get_user_role(auth.uid()) = 'super_admin')
);

-- Add a trigger to update `updated_at` for ai_key_groups
CREATE OR REPLACE FUNCTION public.handle_ai_key_groups_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_ai_key_groups_updated
  BEFORE UPDATE ON public.ai_key_groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_ai_key_groups_updated_at();