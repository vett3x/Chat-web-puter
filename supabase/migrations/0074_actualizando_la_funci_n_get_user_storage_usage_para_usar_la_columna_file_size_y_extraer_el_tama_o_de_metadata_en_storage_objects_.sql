CREATE OR REPLACE FUNCTION public.get_user_storage_usage(p_user_id uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'storage'
AS $function$
DECLARE
    app_files_size BIGINT;
    storage_files_size BIGINT;
BEGIN
    -- Calculate size from DeepAI Coder project files using the new file_size column
    SELECT COALESCE(SUM(file_size), 0)
    INTO app_files_size
    FROM public.app_file_backups
    WHERE user_id = p_user_id;

    -- Calculate size from Supabase Storage (e.g., note images) by extracting from metadata
    -- We need to cast metadata->>'size' to BIGINT
    SELECT COALESCE(SUM((metadata->>'size')::BIGINT), 0)
    INTO storage_files_size
    FROM storage.objects
    WHERE owner = p_user_id;

    RETURN app_files_size + storage_files_size;
END;
$function$