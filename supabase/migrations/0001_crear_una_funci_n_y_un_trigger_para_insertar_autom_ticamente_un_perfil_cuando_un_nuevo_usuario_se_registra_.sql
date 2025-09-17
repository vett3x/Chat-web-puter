CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    new.id, 
    new.raw_user_meta_data ->> 'first_name', 
    new.raw_user_meta_data ->> 'last_name'
  );
  RETURN new;
END;
$$;

-- Eliminar el trigger si ya existe para evitar duplicados
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- Crear el trigger para ejecutar la función después de la inserción de un usuario
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();