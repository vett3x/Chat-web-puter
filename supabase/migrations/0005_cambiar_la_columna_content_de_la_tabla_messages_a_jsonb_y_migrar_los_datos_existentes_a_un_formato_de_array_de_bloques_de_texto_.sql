ALTER TABLE public.messages
ALTER COLUMN content TYPE JSONB USING jsonb_build_array(jsonb_build_object('type', 'text', 'text', content));