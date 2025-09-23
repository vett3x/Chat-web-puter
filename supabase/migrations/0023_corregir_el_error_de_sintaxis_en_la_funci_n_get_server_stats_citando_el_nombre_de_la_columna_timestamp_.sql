-- Create table to store historical server resource usage
CREATE TABLE public.server_resource_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id UUID NOT NULL REFERENCES public.user_servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cpu_usage float4,
  memory_usage_mib int4,
  disk_usage_percent float4,
  network_rx_bytes int8,
  network_tx_bytes int8
);

-- Add index for faster queries
CREATE INDEX idx_server_resource_logs_server_id_created_at
ON public.server_resource_logs (server_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.server_resource_logs ENABLE ROW LEVEL SECURITY;

-- Policies for server_resource_logs
-- Users can view logs for their own servers
CREATE POLICY "Users can view their own server resource logs"
ON public.server_resource_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Function to aggregate server stats
CREATE OR REPLACE FUNCTION get_server_stats(
    p_server_id uuid,
    p_interval text,
    p_date_trunc_unit text
)
RETURNS TABLE(
    "timestamp" timestamptz,
    avg_cpu float,
    avg_memory_mib float,
    avg_disk_percent float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        date_trunc(p_date_trunc_unit, created_at) as "timestamp",
        AVG(cpu_usage) as avg_cpu,
        AVG(memory_usage_mib) as avg_memory_mib,
        AVG(disk_usage_percent) as avg_disk_percent
    FROM
        public.server_resource_logs
    WHERE
        server_id = p_server_id
        AND created_at >= now() - p_interval::interval
    GROUP BY
        1
    ORDER BY
        1;
END;
$$;