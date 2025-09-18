DROP POLICY IF EXISTS "messages_insert_policy" ON public.messages;
CREATE POLICY "messages_insert_policy" ON public.messages
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);