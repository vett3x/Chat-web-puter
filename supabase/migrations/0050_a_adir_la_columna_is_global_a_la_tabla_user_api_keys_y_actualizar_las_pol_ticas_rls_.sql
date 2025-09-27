ALTER TABLE public.user_api_keys
ADD COLUMN is_global BOOLEAN DEFAULT FALSE;

-- Crear una nueva política para que los Super Admins puedan gestionar todas las claves, incluyendo el flag is_global
CREATE POLICY "Super Admins can manage all API keys" ON public.user_api_keys
FOR ALL TO authenticated
USING (get_user_role(auth.uid()) = 'super_admin')
WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

-- Actualizar la política SELECT existente para que los usuarios solo vean sus propias claves NO globales
ALTER POLICY "Users can view their own API keys" ON public.user_api_keys
USING (auth.uid() = user_id AND is_global = FALSE);

-- Actualizar la política INSERT existente para que los usuarios solo inserten claves NO globales
ALTER POLICY "Users can insert their own API keys" ON public.user_api_keys
WITH CHECK (auth.uid() = user_id AND is_global = FALSE);

-- Actualizar la política UPDATE existente para que los usuarios solo actualicen sus propias claves NO globales
ALTER POLICY "Users can update their own API keys" ON public.user_api_keys
USING (auth.uid() = user_id AND is_global = FALSE)
WITH CHECK (auth.uid() = user_id AND is_global = FALSE);

-- Actualizar la política DELETE existente para que los usuarios solo eliminen sus propias claves NO globales
ALTER POLICY "Users can delete their own API keys" ON public.user_api_keys
USING (auth.uid() = user_id AND is_global = FALSE);