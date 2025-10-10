ALTER TABLE public.user_apps
ADD COLUMN IF NOT EXISTS main_purpose TEXT,
ADD COLUMN IF NOT EXISTS key_features TEXT,
ADD COLUMN IF NOT EXISTS preferred_technologies TEXT;