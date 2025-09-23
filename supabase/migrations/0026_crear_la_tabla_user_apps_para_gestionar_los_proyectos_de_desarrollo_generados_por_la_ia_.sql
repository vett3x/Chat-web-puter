-- Crear la tabla user_apps
CREATE TABLE public.user_apps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  server_id UUID REFERENCES public.user_servers(id) ON DELETE SET NULL,
  container_id TEXT,
  tunnel_id UUID REFERENCES public.docker_tunnels(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'provisioning', -- 'provisioning', 'ready', 'failed'
  url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (REQUERIDO para seguridad)
ALTER TABLE public.user_apps ENABLE ROW LEVEL SECURITY;

-- Crear políticas de seguridad para cada operación
CREATE POLICY "Los usuarios solo pueden ver sus propias apps" ON public.user_apps
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios solo pueden insertar sus propias apps" ON public.user_apps
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios solo pueden actualizar sus propias apps" ON public.user_apps
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios solo pueden eliminar sus propias apps" ON public.user_apps
FOR DELETE TO authenticated USING (auth.uid() = user_id);