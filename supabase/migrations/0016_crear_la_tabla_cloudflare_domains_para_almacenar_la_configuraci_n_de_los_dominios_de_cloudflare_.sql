-- Create cloudflare_domains table
CREATE TABLE public.cloudflare_domains (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain_name TEXT NOT NULL UNIQUE, -- e.g., "example.com"
  api_token TEXT NOT NULL, -- Cloudflare API Token (consider encryption in production)
  zone_id TEXT NOT NULL, -- Cloudflare Zone ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (REQUIRED for security)
ALTER TABLE public.cloudflare_domains ENABLE ROW LEVEL SECURITY;

-- Create secure policies for each operation
CREATE POLICY "Users can view their own cloudflare domains" ON public.cloudflare_domains
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cloudflare domains" ON public.cloudflare_domains
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cloudflare domains" ON public.cloudflare_domains
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cloudflare domains" ON public.cloudflare_domains
FOR DELETE TO authenticated USING (auth.uid() = user_id);