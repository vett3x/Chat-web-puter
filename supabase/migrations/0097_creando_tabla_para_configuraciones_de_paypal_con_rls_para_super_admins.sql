-- Create paypal_configs table
CREATE TABLE public.paypal_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nickname TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'unverified', -- unverified, verified, failed
  last_tested_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.paypal_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Super Admins only
CREATE POLICY "Super admins can manage paypal configs"
ON public.paypal_configs
FOR ALL
TO authenticated
USING (get_user_role(auth.uid()) = 'super_admin'::text)
WITH CHECK (get_user_role(auth.uid()) = 'super_admin'::text);

-- Trigger to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION handle_paypal_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_paypal_configs_updated
BEFORE UPDATE ON public.paypal_configs
FOR EACH ROW
EXECUTE FUNCTION handle_paypal_configs_updated_at();