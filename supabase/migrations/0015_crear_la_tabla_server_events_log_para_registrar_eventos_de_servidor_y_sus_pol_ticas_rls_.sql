-- Create server_events_log table
CREATE TABLE public.server_events_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  server_id UUID REFERENCES public.user_servers(id) ON DELETE SET NULL, -- Can be null if event is not server-specific
  event_type TEXT NOT NULL, -- e.g., 'server_added', 'container_started', 'container_stopped', 'container_created', 'server_deleted'
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (REQUIRED for security)
ALTER TABLE public.server_events_log ENABLE ROW LEVEL SECURITY;

-- Create secure policies for each operation
CREATE POLICY "Users can view their own server events" ON public.server_events_log
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own server events" ON public.server_events_log
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- No UPDATE or DELETE policies needed for logs, as they should be immutable.
-- If deletion is ever required, it should be an admin action or a specific policy.