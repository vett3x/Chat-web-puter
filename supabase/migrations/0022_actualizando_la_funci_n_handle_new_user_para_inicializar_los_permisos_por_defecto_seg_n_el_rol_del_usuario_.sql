CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  default_permissions JSONB;
BEGIN
  -- Set default permissions based on role
  IF new.email = 'martinpensa1@gmail.com' THEN
    default_permissions := '{"can_create_server": true, "can_manage_docker_containers": true, "can_manage_cloudflare_domains": true, "can_manage_cloudflare_tunnels": true}';
  ELSIF new.raw_user_meta_data ->> 'role' = 'admin' THEN
    default_permissions := '{"can_create_server": true, "can_manage_docker_containers": false, "can_manage_cloudflare_domains": false, "can_manage_cloudflare_tunnels": false}';
  ELSE -- Default for 'user' role
    default_permissions := '{"can_create_server": false, "can_manage_docker_containers": false, "can_manage_cloudflare_domains": false, "can_manage_cloudflare_tunnels": false}';
  END IF;

  INSERT INTO public.profiles (id, first_name, last_name, role, permissions)
  VALUES (
    new.id, 
    new.raw_user_meta_data ->> 'first_name', 
    new.raw_user_meta_data ->> 'last_name',
    COALESCE(new.raw_user_meta_data ->> 'role', 'user')::text, -- Use role from metadata if available, else 'user'
    default_permissions
  );
  RETURN new;
END;
$$;