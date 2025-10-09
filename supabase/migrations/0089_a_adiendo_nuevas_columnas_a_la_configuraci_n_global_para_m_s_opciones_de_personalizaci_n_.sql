-- Add new columns to the global_settings table for favicon, tagline, and default AI model
ALTER TABLE public.global_settings
ADD COLUMN IF NOT EXISTS app_favicon_url TEXT,
ADD COLUMN IF NOT EXISTS app_tagline TEXT,
ADD COLUMN IF NOT EXISTS default_ai_model TEXT;