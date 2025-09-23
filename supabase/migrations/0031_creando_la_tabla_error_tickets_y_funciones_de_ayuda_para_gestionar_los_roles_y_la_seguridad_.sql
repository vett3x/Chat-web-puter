-- Crear la tabla para almacenar los tickets de error
CREATE TABLE public.error_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    error_message JSONB,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'new' NOT NULL -- por ejemplo: new, in_progress, resolved
);

-- Habilitar RLS para seguridad
ALTER TABLE public.error_tickets ENABLE ROW LEVEL SECURITY;

-- Función auxiliar para obtener el rol de un usuario
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM public.profiles
    WHERE id = p_user_id;
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas de RLS para la tabla de tickets
-- Los usuarios pueden crear sus propios tickets.
CREATE POLICY "Users can insert their own error tickets"
ON public.error_tickets FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Los administradores y superadministradores pueden ver todos los tickets.
CREATE POLICY "Admins can view all error tickets"
ON public.error_tickets FOR SELECT
TO authenticated
USING (get_user_role(auth.uid()) IN ('admin', 'super_admin'));

-- Los administradores y superadministradores pueden actualizar los tickets.
CREATE POLICY "Admins can update error tickets"
ON public.error_tickets FOR UPDATE
TO authenticated
USING (get_user_role(auth.uid()) IN ('admin', 'super_admin'));

-- Los administradores y superadministradores pueden eliminar los tickets.
CREATE POLICY "Admins can delete error tickets"
ON public.error_tickets FOR DELETE
TO authenticated
USING (get_user_role(auth.uid()) IN ('admin', 'super_admin'));