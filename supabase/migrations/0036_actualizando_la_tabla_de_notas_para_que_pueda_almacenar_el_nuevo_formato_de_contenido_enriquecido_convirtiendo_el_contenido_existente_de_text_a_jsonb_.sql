ALTER TABLE public.notes
ALTER COLUMN content TYPE JSONB USING CASE
    WHEN content IS NULL OR content = '' THEN '[]'::jsonb
    WHEN content ~ '^\s*\[.*\]\s*$' THEN content::jsonb
    ELSE jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', content))))
END;