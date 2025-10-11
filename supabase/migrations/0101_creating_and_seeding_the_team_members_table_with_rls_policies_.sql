-- Create team_members table
CREATE TABLE public.team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT,
  handle TEXT,
  status TEXT,
  contact_text TEXT,
  avatar_url TEXT,
  order_index INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Policies
-- Public can read team members
CREATE POLICY "team_members_public_read_policy" ON public.team_members
FOR SELECT USING (true);

-- Super admins can manage team members
CREATE POLICY "team_members_super_admin_manage_policy" ON public.team_members
FOR ALL TO authenticated
USING (get_user_role(auth.uid()) = 'super_admin'::text)
WITH CHECK (get_user_role(auth.uid()) = 'super_admin'::text);

-- Seed with initial data
INSERT INTO public.team_members (name, title, handle, status, contact_text, avatar_url, order_index)
VALUES
  ('Javi A. Torres', 'Software Engineer & Founder', 'javicodes', 'Online', 'Contactar', 'https://i.pravatar.cc/500?u=javier', 1),
  ('Sofía Pérez', 'AI Specialist & Co-Founder', 'sofia_ai', 'Developing', 'Contactar', 'https://i.pravatar.cc/500?u=sofia', 2);