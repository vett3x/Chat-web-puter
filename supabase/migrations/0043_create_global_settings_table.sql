-- Create global_settings table
CREATE TABLE public.global_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  security_enabled BOOLEAN DEFAULT TRUE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (REQUIRED)
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

-- Policies for global_settings
-- Only Super Admins can select settings
CREATE POLICY "Super Admins can view global settings" ON public.global_settings
FOR SELECT TO authenticated USING (get_user_role(auth.uid()) = 'super_admin');

-- Only Super Admins can update settings
CREATE POLICY "Super Admins can update global settings" ON public.global_settings
FOR UPDATE TO authenticated USING (get_user_role(auth.uid()) = 'super_admin');

-- Insert initial data (only one row expected)
INSERT INTO public.global_settings (security_enabled)
VALUES (TRUE)
ON CONFLICT (id) DO NOTHING; -- Ensure only one row is ever inserted