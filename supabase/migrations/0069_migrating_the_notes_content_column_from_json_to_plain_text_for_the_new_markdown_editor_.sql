-- This safely converts your existing notes' content into a text format.
ALTER TABLE public.notes
ALTER COLUMN content TYPE TEXT USING content::text;