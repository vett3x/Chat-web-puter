-- Create the table to store user API keys
CREATE TABLE public.user_api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  nickname TEXT
);

-- Add comments to explain the table and columns
COMMENT ON TABLE public.user_api_keys IS 'Stores API keys for various AI providers, managed by users.';
COMMENT ON COLUMN public.user_api_keys.provider IS 'The AI provider, e.g., ''google_gemini''.';
COMMENT ON COLUMN public.user_api_keys.api_key IS 'The API key provided by the user.';
COMMENT ON COLUMN public.user_api_keys.nickname IS 'A user-friendly name for the key.';

-- Enable RLS
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only manage their own keys.
CREATE POLICY "Users can view their own API keys"
ON public.user_api_keys FOR SELECT
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own API keys"
ON public.user_api_keys FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys"
ON public.user_api_keys FOR UPDATE
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys"
ON public.user_api_keys FOR DELETE
TO authenticated USING (auth.uid() = user_id);