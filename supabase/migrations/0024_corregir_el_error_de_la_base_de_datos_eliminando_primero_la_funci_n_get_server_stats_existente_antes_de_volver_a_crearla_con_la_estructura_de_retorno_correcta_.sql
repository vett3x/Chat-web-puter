-- Drop the old function if it exists, to allow changing the return type
DROP FUNCTION IF EXISTS get_server_stats(uuid, text, text);

-- Function to aggregate server stats with a non-reserved column name
CREATE OR REPLACE FUNCTION get_server_stats(
    p_server_id uuid,
    p_interval text,
    p_date_trunc_unit text
)
RETURNS TABLE(
    log_timestamp timestamptz,
    avg_cpu float,
    avg_memory_mib float,
    avg_disk_percent float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        date_trunc(p_date_trunc_unit, created_at) as log_timestamp,
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