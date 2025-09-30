-- Add the new column to store the template
ALTER TABLE public.global_settings ADD COLUMN docker_run_template TEXT;

-- Set a default, placeholder-based template for the existing row
UPDATE public.global_settings
SET docker_run_template = 'docker run -d --name [nombre-generado] -p [puerto-aleatorio]:3000 [quota_flags] [variables_de_entorno_bd] -v [volumen-generado] --entrypoint tail [imagen_base] -f /dev/null'
WHERE id = '00000000-0000-0000-0000-000000000000';