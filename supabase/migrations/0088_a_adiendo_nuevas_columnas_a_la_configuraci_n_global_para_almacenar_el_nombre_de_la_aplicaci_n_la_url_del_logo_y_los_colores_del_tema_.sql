-- Add columns for app name, logo, and theme colors
ALTER TABLE public.global_settings
ADD COLUMN IF NOT EXISTS app_name TEXT,
ADD COLUMN IF NOT EXISTS app_logo_url TEXT,
ADD COLUMN IF NOT EXISTS theme_primary_color TEXT,
ADD COLUMN IF NOT EXISTS theme_sidebar_color TEXT;