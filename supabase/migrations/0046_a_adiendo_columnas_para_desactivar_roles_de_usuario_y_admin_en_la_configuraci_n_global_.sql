-- Add columns to disable user and admin roles
ALTER TABLE public.global_settings
ADD COLUMN IF NOT EXISTS users_disabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS admins_disabled BOOLEAN NOT NULL DEFAULT false;