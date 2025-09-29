-- Add columns for resource quotas to the profiles table
ALTER TABLE public.profiles
ADD COLUMN max_servers INT NOT NULL DEFAULT 2,
ADD COLUMN max_containers INT NOT NULL DEFAULT 5,
ADD COLUMN max_tunnels INT NOT NULL DEFAULT 5;

-- Update existing profiles with default values where they are NULL (just in case)
UPDATE public.profiles SET max_servers = 2 WHERE max_servers IS NULL;
UPDATE public.profiles SET max_containers = 5 WHERE max_containers IS NULL;
UPDATE public.profiles SET max_tunnels = 5 WHERE max_tunnels IS NULL;

-- Update the handle_new_user function to set quotas based on role
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
BEGIN
  -- Set default permissions and quotas based on role
  IF new.email = 'martinpensa1@gmail.com' THEN
    default_permissions := '{"can_create_server": true, "can_manage_docker_containers": true, "can_manage_cloudflare_domains": true, "can_manage_cloudflare_tunnels": true}';
    v_max_servers := 999;
    v_max_containers := 999;
    v_max_tunnels := 999;
  ELSIF new.raw_user_meta_data ->> 'role' = 'admin' THEN
    default_permissions := '{"can_create_server": true, "can_manage_docker_containers": false, "can_manage_cloudflare_domains": false, "can_manage_cloudflare_tunnels": false}';
    v_max_servers := 10;
    v_max_containers := 20;
    v_max_tunnels := 20;
  ELSE -- Default for 'user' role
    default_permissions := '{"can_create_server": false, "can_manage_docker_containers": false, "can_manage_cloudflare_domains": false, "can_manage_cloudflare_tunnels": false}';
    v_max_servers := 2;
    v_max_containers := 5;
    v_max_tunnels := 5;
  END IF;

  INSERT INTO public.profiles (id, first_name, last_name, role, permissions, max_servers, max_containers, max_tunnels)
  VALUES (
    new.id, 
    new.raw_user_meta_data ->> 'first_name', 
    new.raw_user_meta_data ->> 'last_name',
    COALESCE(new.raw_user_meta_data ->> 'role', 'user')::text, -- Use role from metadata if available, else 'user'
    default_permissions,
    v_max_servers,
    v_max_containers,
    v_max_tunnels
  );
  RETURN new;
END;
$function$;