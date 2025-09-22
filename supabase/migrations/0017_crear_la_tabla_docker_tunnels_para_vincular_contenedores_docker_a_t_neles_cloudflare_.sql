-- Create docker_tunnels table
CREATE TABLE public.docker_tunnels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  server_id UUID NOT NULL REFERENCES public.user_servers(id) ON DELETE CASCADE,
  container_id TEXT NOT NULL, -- Docker container ID
  cloudflare_domain_id UUID NOT NULL REFERENCES public.cloudflare_domains(id) ON DELETE CASCADE,
  subdomain TEXT NOT NULL, -- e.g., "mke30dolasjhdnc"
  full_domain TEXT NOT NULL UNIQUE, -- e.g., "mke30dolasjhdnc.example.com"
  container_port INTEGER NOT NULL, -- The internal port of the Docker container
  host_port INTEGER, -- The external port exposed by the Docker container, if any, or the one we want to tunnel to
  tunnel_id TEXT, -- Cloudflare Tunnel ID (from Cloudflare API)
  tunnel_secret TEXT, -- Cloudflare Tunnel Secret (consider encryption in production)
  status TEXT DEFAULT 'pending' NOT NULL, -- 'pending', 'provisioning', 'active', 'failed'
  provisioning_log TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (server_id, container_id, container_port) -- A container port can only have one tunnel per server
);

-- Enable RLS (REQUIRED for security)
ALTER TABLE public.docker_tunnels ENABLE ROW LEVEL SECURITY;

-- Create secure policies for each operation
CREATE POLICY "Users can view their own docker tunnels" ON public.docker_tunnels
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own docker tunnels" ON public.docker_tunnels
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own docker tunnels" ON public.docker_tunnels
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own docker tunnels" ON public.docker_tunnels
FOR DELETE TO authenticated USING (auth.uid() = user_id);