-- Add a 'provider' column to distinguish between key types (e.g., Google Gemini, Custom)
ALTER TABLE public.user_api_keys ADD COLUMN provider TEXT NOT NULL DEFAULT 'custom_openai';

-- Make endpoint and model name nullable, as they are only needed for custom providers
ALTER TABLE public.user_api_keys ALTER COLUMN api_endpoint DROP NOT NULL;
ALTER TABLE public.user_api_keys ALTER COLUMN model_name DROP NOT NULL;

-- Rename the 'name' column to 'nickname' for clarity
ALTER TABLE public.user_api_keys RENAME COLUMN name TO nickname;