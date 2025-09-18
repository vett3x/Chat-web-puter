-- Crear la tabla para almacenar la información de los servidores de los usuarios
CREATE TABLE public.user_servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    ip_address TEXT NOT NULL,
    ssh_port INTEGER NOT NULL DEFAULT 22,
    ssh_username TEXT NOT NULL,
    ssh_password TEXT NOT NULL, -- NOTA: Almacenado en texto plano. Considerar cifrado en producción.
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Crear un trigger para actualizar el campo updated_at automáticamente
CREATE OR REPLACE FUNCTION public.handle_user_servers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_user_servers_updated
BEFORE UPDATE ON public.user_servers
FOR EACH ROW
EXECUTE FUNCTION public.handle_user_servers_updated_at();

-- Añadir comentarios a la tabla y columnas para mayor claridad
COMMENT ON TABLE public.user_servers IS 'Almacena la información de los servidores SSH registrados por los usuarios.';
COMMENT ON COLUMN public.user_servers.id IS 'Identificador único del servidor.';
COMMENT ON COLUMN public.user_servers.user_id IS 'ID del usuario propietario del servidor.';
COMMENT ON COLUMN public.user_servers.name IS 'Nombre o alias opcional para el servidor.';
COMMENT ON COLUMN public.user_servers.ip_address IS 'Dirección IP del servidor.';
COMMENT ON COLUMN public.user_servers.ssh_port IS 'Puerto SSH del servidor.';
COMMENT ON COLUMN public.user_servers.ssh_username IS 'Nombre de usuario para la conexión SSH.';
COMMENT ON COLUMN public.user_servers.ssh_password IS 'Contraseña para la conexión SSH (almacenada en texto plano).';
COMMENT ON COLUMN public.user_servers.created_at IS 'Fecha y hora de creación del registro.';
COMMENT ON COLUMN public.user_servers.updated_at IS 'Fecha y hora de la última actualización del registro.';