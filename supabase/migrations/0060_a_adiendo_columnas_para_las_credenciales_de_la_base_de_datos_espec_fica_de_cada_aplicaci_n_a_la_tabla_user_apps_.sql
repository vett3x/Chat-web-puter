ALTER TABLE public.user_apps
ADD COLUMN db_host TEXT,
ADD COLUMN db_port INTEGER,
ADD COLUMN db_name TEXT,
ADD COLUMN db_user TEXT,
ADD COLUMN db_password TEXT;