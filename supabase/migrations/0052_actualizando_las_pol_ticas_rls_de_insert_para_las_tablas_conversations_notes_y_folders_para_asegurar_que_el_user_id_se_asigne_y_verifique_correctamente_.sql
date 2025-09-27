-- Actualizar política INSERT para 'conversations'
DROP POLICY IF EXISTS "conversations_insert_policy" ON public.conversations;
CREATE POLICY "conversations_insert_policy" ON public.conversations
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Actualizar política INSERT para 'notes'
DROP POLICY IF EXISTS "notes_insert_policy" ON public.notes;
CREATE POLICY "notes_insert_policy" ON public.notes
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Actualizar política INSERT para 'folders'
DROP POLICY IF EXISTS "Folders can only be created by their owner" ON public.folders;
CREATE POLICY "Folders can only be created by their owner" ON public.folders
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);