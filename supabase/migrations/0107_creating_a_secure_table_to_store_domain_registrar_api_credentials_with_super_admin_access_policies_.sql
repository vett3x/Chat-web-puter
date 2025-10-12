-- Create domain_registrars table
CREATE TABLE public.domain_registrars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nickname TEXT NOT NULL,
  provider TEXT NOT NULL, -- e.g., 'dinahosting'
  api_username TEXT NOT NULL,
  api_password TEXT NOT NULL, -- Note: Storing sensitive data. Encryption at rest is recommended.
  is_active BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'unverified', -- 'unverified', 'verified', 'failed'
  last_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create a trigger to handle updated_at
CREATE OR REPLACE FUNCTION public.handle_domain_registrars_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_domain_registrars_updated
BEFORE UPDATE ON public.domain_registrars
FOR EACH ROW
EXECUTE FUNCTION public.handle_domain_registrars_updated_at();

-- Enable RLS (REQUIRED for security)
ALTER TABLE public.domain_registrars ENABLE ROW LEVEL SECURITY;

-- Create policies for super_admin access
CREATE POLICY "super_admin_can_manage_domain_registrars"
ON public.domain_registrars
FOR ALL
TO authenticated
USING (get_user_role(auth.uid()) = 'super_admin'::text)
WITH CHECK (get_user_role(auth.uid()) = 'super_admin'::text);