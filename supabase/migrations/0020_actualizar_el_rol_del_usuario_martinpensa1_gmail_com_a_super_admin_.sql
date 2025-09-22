UPDATE public.profiles
SET role = 'super_admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'martinpensa1@gmail.com');