CREATE OR REPLACE FUNCTION public.get_app_versions_with_file_counts(p_app_id uuid, p_user_id uuid, p_limit integer)
 RETURNS TABLE(created_at timestamp with time zone, file_count bigint)
 LANGUAGE plpgsql
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
$function$