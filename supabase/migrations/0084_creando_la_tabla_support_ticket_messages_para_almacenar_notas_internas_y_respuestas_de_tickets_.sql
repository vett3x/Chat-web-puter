CREATE TABLE public.support_ticket_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_internal_note BOOLEAN DEFAULT FALSE, -- TRUE para notas internas, FALSE para respuestas públicas
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para support_ticket_messages
-- Los usuarios pueden ver los mensajes de sus propios tickets
CREATE POLICY "Users can view their own ticket messages" ON public.support_ticket_messages
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND user_id = auth.uid())
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin')
);

-- Los administradores pueden insertar mensajes
CREATE POLICY "Admins can insert messages" ON public.support_ticket_messages
FOR INSERT TO authenticated WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin')
);

-- Los administradores pueden actualizar mensajes (si fuera necesario)
CREATE POLICY "Admins can update messages" ON public.support_ticket_messages
FOR UPDATE TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin')
);

-- Los administradores pueden eliminar mensajes (si fuera necesario)
CREATE POLICY "Admins can delete messages" ON public.support_ticket_messages
FOR DELETE TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin')
);