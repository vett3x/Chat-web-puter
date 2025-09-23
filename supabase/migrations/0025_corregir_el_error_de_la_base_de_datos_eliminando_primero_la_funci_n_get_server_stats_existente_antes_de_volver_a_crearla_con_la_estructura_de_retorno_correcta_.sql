-- Drop the old function if it exists, to allow changing the return type
DROP FUNCTION IF EXISTS public.get_server_stats(uuid, text, text);

-- Re-create the function with the correct return types and explicit casting
CREATE OR REPLACE FUNCTION public.get_server_stats(
    p_server_id uuid,
    p_interval text,
    p_date_trunc_unit text
)
RETURNS TABLE(
    log_timestamp timestamptz,
    avg_cpu double precision,
    avg_memory_mib double precision,
    avg_disk_percent double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        date_trunc(p_date_trunc_unit, created_at) as log_timestamp,
        AVG(cpu_usage)::double precision as avg_cpu,
        AVG(memory_usage_mib)::double precision as avg_memory_mib,
        AVG(disk_usage_percent)::double precision as avg_disk_percent
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