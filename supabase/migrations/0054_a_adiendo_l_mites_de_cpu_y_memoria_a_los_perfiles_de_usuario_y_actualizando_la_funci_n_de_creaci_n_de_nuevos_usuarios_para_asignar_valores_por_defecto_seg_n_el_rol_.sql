-- 1. Add new columns for resource limits to the profiles table
ALTER TABLE public.profiles
ADD COLUMN cpu_limit DECIMAL(3, 2) NOT NULL DEFAULT 1.00,
ADD COLUMN memory_limit_mb INT NOT NULL DEFAULT 1024;

-- 2. Update the handle_new_user function to include these new limits
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
BEGIN
  -- Set default permissions and quotas based on role
  IF new.email = 'martinpensa1@gmail.com' THEN
    default_permissions := '{"can_create_server": true, "can_manage_docker_containers": true, "can_manage_cloudflare_domains": true, "can_manage_cloudflare_tunnels": true}';
    v_max_servers := 999;
    v_max_containers := 999;
    v_max_tunnels := 999;
    v_cpu_limit := 4.00; -- 4 CPU cores
    v_memory_limit_mb := 8192; -- 8 GB RAM
  ELSIF new.raw_user_meta_data ->> 'role' = 'admin' THEN
    default_permissions := '{"can_create_server": true, "can_manage_docker_containers": false, "can_manage_cloudflare_domains": false, "can_manage_cloudflare_tunnels": false}';
    v_max_servers := 10;
    v_max_containers := 20;
    v_max_tunnels := 20;
    v_cpu_limit := 2.00; -- 2 CPU cores
    v_memory_limit_mb := 4096; -- 4 GB RAM
  ELSE -- Default for 'user' role
    default_permissions := '{"can_create_server": false, "can_manage_docker_containers": false, "can_manage_cloudflare_domains": false, "can_manage_cloudflare_tunnels": false}';
    v_max_servers := 2;
    v_max_containers := 5;
    v_max_tunnels := 5;
    v_cpu_limit := 1.00; -- 1 CPU core
    v_memory_limit_mb := 1024; -- 1 GB RAM
  END IF;

  INSERT INTO public.profiles (id, first_name, last_name, role, permissions, max_servers, max_containers, max_tunnels, cpu_limit, memory_limit_mb)
  VALUES (
    new.id, 
    new.raw_user_meta_data ->> 'first_name', 
    new.raw_user_meta_data ->> 'last_name',
    COALESCE(new.raw_user_meta_data ->> 'role', 'user')::text, -- Use role from metadata if available, else 'user'
    default_permissions,
    v_max_servers,
    v_max_containers,
    v_max_tunnels,
    v_cpu_limit,
    v_memory_limit_mb
  );
  RETURN new;
END;
$function$;