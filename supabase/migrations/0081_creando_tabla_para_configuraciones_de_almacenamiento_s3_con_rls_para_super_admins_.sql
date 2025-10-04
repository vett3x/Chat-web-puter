-- Create the table to store S3 storage configurations
CREATE TABLE public.s3_storage_configs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nickname TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    bucket_name TEXT NOT NULL,
    region TEXT NOT NULL,
    access_key_id TEXT NOT NULL, -- Will be encrypted
    secret_access_key TEXT NOT NULL, -- Will be encrypted
    is_active BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'unverified', -- 'unverified', 'verified', 'failed'
    last_tested_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.s3_storage_configs ENABLE ROW LEVEL SECURITY;

-- Create policies: Only Super Admins can manage S3 configurations
CREATE POLICY "Super admins can manage S3 storage configs"
ON public.s3_storage_configs
FOR ALL
TO authenticated
USING (get_user_role(auth.uid()) = 'super_admin')
WITH CHECK (get_user_role(auth.uid()) = 'super_admin');