-- Add a column to store the custom login background URL
ALTER TABLE public.global_settings
ADD COLUMN IF NOT EXISTS login_background_url TEXT;