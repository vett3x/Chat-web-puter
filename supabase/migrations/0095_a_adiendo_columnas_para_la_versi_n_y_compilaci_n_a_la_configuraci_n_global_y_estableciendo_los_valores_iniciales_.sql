-- Add columns to store app version and build number
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS app_version TEXT;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS app_build_number TEXT;

-- Set initial values based on the last known hardcoded version
UPDATE public.global_settings
SET 
  app_version = 'v0.4b Stable',
  app_build_number = '802'
WHERE id = '00000000-0000-0000-0000-000000000000';