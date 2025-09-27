-- Set default user_id on tables to the currently authenticated user
ALTER TABLE public.conversations ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.notes ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.folders ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Drop existing insert policies if they exist
DROP POLICY IF EXISTS "Users can insert their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can insert their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can insert their own folders" ON public.folders;

-- Recreate INSERT policies with a simple check.
-- The DEFAULT value will handle setting the user_id, and this policy ensures it's correct.
CREATE POLICY "Users can insert their own conversations"
ON public.conversations
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can insert their own notes"
ON public.notes
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can insert their own folders"
ON public.folders
FOR INSERT
WITH CHECK (user_id = auth.uid());