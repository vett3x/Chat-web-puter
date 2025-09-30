CREATE OR REPLACE FUNCTION get_app_versions_with_file_counts(p_app_id UUID, p_user_id UUID, p_limit INT)
RETURNS TABLE(created_at TIMESTAMP WITH TIME ZONE, file_count BIGINT) AS $$
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
$$ LANGUAGE plpgsql;