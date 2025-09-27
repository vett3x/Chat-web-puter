-- Add a status column to the profiles table to track user state (active, banned, etc.)
ALTER TABLE public.profiles
ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

-- Create an index on the new status column for faster queries
CREATE INDEX idx_profiles_status ON public.profiles(status);

-- Backfill the status for existing users to ensure data consistency
UPDATE public.profiles SET status = 'active' WHERE status IS NULL;