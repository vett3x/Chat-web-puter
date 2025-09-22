-- Add role column to profiles table
ALTER TABLE public.profiles
ADD COLUMN role TEXT NOT NULL DEFAULT 'user';

-- Update handle_new_user function to set role based on email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (
    new.id, 
    new.raw_user_meta_data ->> 'first_name', 
    new.raw_user_meta_data ->> 'last_name',
    CASE
      WHEN new.email = 'martinpensa1@gmail.com' THEN 'super_admin'
      ELSE 'user'
    END
  );
  RETURN new;
END;
$$;