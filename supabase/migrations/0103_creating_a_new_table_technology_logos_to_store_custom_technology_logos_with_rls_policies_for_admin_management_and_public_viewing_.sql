-- Create the table to store technology logos
CREATE TABLE public.technology_logos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT NOT NULL,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.technology_logos ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access for everyone
CREATE POLICY "Public read access for technology logos"
ON public.technology_logos
FOR SELECT
USING (true);

-- Policy: Allow Super Admins to manage all logos
CREATE POLICY "Super Admins can manage technology logos"
ON public.technology_logos
FOR ALL
TO authenticated
USING (get_user_role(auth.uid()) = 'super_admin')
WITH CHECK (get_user_role(auth.uid()) = 'super_admin');