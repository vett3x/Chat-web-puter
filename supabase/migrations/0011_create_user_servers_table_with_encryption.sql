-- Crear la tabla user_servers
CREATE TABLE public.user_servers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT,
  ip_address TEXT NOT NULL,
  ssh_port INT NOT NULL DEFAULT 22,
  ssh_username TEXT NOT NULL,
  encrypted_ssh_password TEXT NOT NULL, -- Contraseña cifrada
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Habilitar RLS en la tabla user_servers
ALTER TABLE public.user_servers ENABLE ROW LEVEL SECURITY;

-- Política para que los usuarios puedan ver sus propios servidores
CREATE POLICY "Users can view their own servers." ON public.user_servers
  FOR SELECT USING (auth.uid() = user_id);

-- Política para que los usuarios puedan insertar sus propios servidores
CREATE POLICY "Users can insert their own servers." ON public.user_servers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Política para que los usuarios puedan actualizar sus propios servidores
CREATE POLICY "Users can update their own servers." ON public.user_servers
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Política para que los usuarios puedan eliminar sus propios servidores
CREATE POLICY "Users can delete their own servers." ON public.user_servers
  FOR DELETE USING (auth.uid() = user_id);

-- Crear una función para actualizar 'updated_at' automáticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear un trigger para la función 'update_updated_at_column' en 'user_servers'
CREATE TRIGGER update_user_servers_updated_at
BEFORE UPDATE ON public.user_servers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();