-- 1. Add storage limit column to profiles table
ALTER TABLE public.profiles
ADD COLUMN storage_limit_mb INTEGER NOT NULL DEFAULT 100;

-- 2. Update the handle_new_user function to set default storage limits by role
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  default_permissions JSONB;
  v_max_servers INT;
  v_max_containers INT;
  v_max_tunnels INT;
  v_cpu_limit DECIMAL(3, 2);
  v_memory_limit_mb INT;
  v_storage_limit_mb INT; -- New variable for storage limit
BEGIN
  -- Set default permissions and quotas based on role
  IF new.email = 'martinpensa1@gmail.com' THEN
    default_permissions := '{"can_create_server": true, "can_manage_docker_containers": true, "can_manage_cloudflare_domains": true, "can_manage_cloudflare_tunnels": true}';
    v_max_servers := 999;
    v_max_containers := 999;
    v_max_tunnels := 999;
    v_cpu_limit := 4.00;
    v_memory_limit_mb := 8192;
    v_storage_limit_mb := 10240; -- 10 GB for super admin
  ELSIF new.raw_user_meta_data ->> 'role' = 'admin' THEN
    default_permissions := '{"can_create_server": true, "can_manage_docker_containers": false, "can_manage_cloudflare_domains": false, "can_manage_cloudflare_tunnels": false}';
    v_max_servers := 10;
    v_max_containers := 20;
    v_max_tunnels := 20;
    v_cpu_limit := 2.00;
    v_memory_limit_mb := 4096;
    v_storage_limit_mb := 1024; -- 1 GB for admin
  ELSE -- Default for 'user' role
    default_permissions := '{"can_create_server": false, "can_manage_docker_containers": false, "can_manage_cloudflare_domains": false, "can_manage_cloudflare_tunnels": false}';
    v_max_servers := 2;
    v_max_containers := 5;
    v_max_tunnels := 5;
    v_cpu_limit := 1.00;
    v_memory_limit_mb := 1024;
    v_storage_limit_mb := 100; -- 100 MB for user
  END IF;

  INSERT INTO public.profiles (id, first_name, last_name, role, permissions, max_servers, max_containers, max_tunnels, cpu_limit, memory_limit_mb, storage_limit_mb)
  VALUES (
    new.id, 
    new.raw_user_meta_data ->> 'first_name', 
    new.raw_user_meta_data ->> 'last_name',
    COALESCE(new.raw_user_meta_data ->> 'role', 'user')::text,
    default_permissions,
    v_max_servers,
    v_max_containers,
    v_max_tunnels,
    v_cpu_limit,
    v_memory_limit_mb,
    v_storage_limit_mb -- Add storage limit to insert
  );
  RETURN new;
END;
$function$;

-- 3. Create a function to calculate total user storage usage
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
    -- Calculate size from DeepAI Coder project files
    SELECT COALESCE(SUM(pg_column_size(file_content)), 0)
    INTO app_files_size
    FROM public.app_file_backups
    WHERE user_id = p_user_id;

    -- Calculate size from Supabase Storage (e.g., note images)
    SELECT COALESCE(SUM(size), 0)
    INTO storage_files_size
    FROM storage.objects
    WHERE owner = p_user_id;

    RETURN app_files_size + storage_files_size;
END;
$function$;