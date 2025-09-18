DROP POLICY IF EXISTS "Folders can only be created by their owner" ON public.folders;
CREATE POLICY "Folders can only be created by their owner" ON public.folders
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);