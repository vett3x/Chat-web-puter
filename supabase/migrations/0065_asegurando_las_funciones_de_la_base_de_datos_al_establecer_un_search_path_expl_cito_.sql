-- Fixing function: public.handle_notes_updated_at
CREATE OR REPLACE FUNCTION public.handle_notes_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Fixing function: public.get_user_role
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM public.profiles
    WHERE id = p_user_id;
    RETURN user_role;
END;
$function$;

-- Fixing function: public.handle_ai_key_groups_updated_at
CREATE OR REPLACE FUNCTION public.handle_ai_key_groups_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Fixing function: public.get_app_versions_with_file_counts
CREATE OR REPLACE FUNCTION public.get_app_versions_with_file_counts(p_app_id uuid, p_user_id uuid, p_limit integer)
 RETURNS TABLE(created_at timestamp with time zone, file_count bigint)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        av.created_at,
        COUNT(afb.id) as file_count
    FROM
        public.app_versions av
    LEFT JOIN
        public.app_file_backups afb ON av.id = afb.version_id
    WHERE
        av.app_id = p_app_id AND av.user_id = p_user_id
    GROUP BY
        av.id, av.created_at
    ORDER BY
        av.created_at DESC
    LIMIT
        p_limit;
END;
$function$;

-- Fixing function: public.get_server_stats
CREATE OR REPLACE FUNCTION public.get_server_stats(p_server_id uuid, p_interval text, p_date_trunc_unit text)
 RETURNS TABLE(log_timestamp timestamp with time zone, avg_cpu double precision, avg_memory_mib double precision, avg_disk_percent double precision)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$;

-- Fixing function: public.handle_user_servers_updated_at
CREATE OR REPLACE FUNCTION public.handle_user_servers_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Fixing function: public.append_to_provisioning_log
CREATE OR REPLACE FUNCTION public.append_to_provisioning_log(server_id uuid, log_content text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.user_servers
  SET provisioning_log = COALESCE(provisioning_log, '') || log_content
  WHERE id = server_id;
END;
$function$;