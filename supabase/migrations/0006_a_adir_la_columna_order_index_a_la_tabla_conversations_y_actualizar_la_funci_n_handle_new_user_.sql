ALTER TABLE public.conversations
ADD COLUMN order_index REAL DEFAULT EXTRACT(EPOCH FROM NOW());

-- Actualizar la función handle_new_user para incluir order_index si fuera necesario,
-- pero como handle_new_user solo inserta en profiles, no es necesario modificarla aquí.
-- Si en el futuro se insertaran conversaciones directamente desde un trigger de auth.users,
-- se debería considerar añadir el order_index en ese trigger.

-- Para las conversaciones existentes, podemos establecer un order_index inicial
-- basado en su created_at para mantener un orden lógico.
UPDATE public.conversations
SET order_index = EXTRACT(EPOCH FROM created_at)
WHERE order_index IS NULL;