-- Reset the global_settings table to ensure only one row exists
DELETE FROM public.global_settings;

INSERT INTO public.global_settings (id, security_enabled, maintenance_mode_enabled)
VALUES ('00000000-0000-0000-0000-000000000000', true, false);