-- Create smtp_configs table
CREATE TABLE public.smtp_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nickname TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  secure BOOLEAN NOT NULL DEFAULT true,
  "user" TEXT NOT NULL,
  password TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'unverified', -- unverified, verified, failed
  last_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.smtp_configs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for super admins
CREATE POLICY "Super admins can manage smtp configs"
ON public.smtp_configs
FOR ALL
TO authenticated
USING (get_user_role(auth.uid()) = 'super_admin'::text)
WITH CHECK (get_user_role(auth.uid()) = 'super_admin'::text);

-- Trigger to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.handle_smtp_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_smtp_configs_updated
BEFORE UPDATE ON public.smtp_configs
FOR EACH ROW
EXECUTE FUNCTION public.handle_smtp_configs_updated_at();