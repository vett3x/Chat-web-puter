-- Rename 'provider' to 'name' for user-defined labels
ALTER TABLE public.user_api_keys RENAME COLUMN provider TO name;

-- Drop the now redundant 'nickname' column
ALTER TABLE public.user_api_keys DROP COLUMN nickname;

-- Add new columns for custom endpoints and models.
-- We provide a default value to populate existing rows, and set NOT NULL immediately.
ALTER TABLE public.user_api_keys ADD COLUMN api_endpoint TEXT NOT NULL DEFAULT 'https://api.openai.com/v1';
ALTER TABLE public.user_api_keys ADD COLUMN model_name TEXT NOT NULL DEFAULT 'gpt-4';

-- Now, remove the default values as they were only needed for the migration.
-- New rows will require these fields to be specified explicitly.
ALTER TABLE public.user_api_keys ALTER COLUMN api_endpoint DROP DEFAULT;
ALTER TABLE public.user_api_keys ALTER COLUMN model_name DROP DEFAULT;

-- Ensure the existing api_key column is also not null.
-- First, update any existing NULL api_key values to a placeholder to avoid errors.
UPDATE public.user_api_keys SET api_key = 'placeholder_key' WHERE api_key IS NULL;
-- Then, apply the NOT NULL constraint.
ALTER TABLE public.user_api_keys ALTER COLUMN api_key SET NOT NULL;