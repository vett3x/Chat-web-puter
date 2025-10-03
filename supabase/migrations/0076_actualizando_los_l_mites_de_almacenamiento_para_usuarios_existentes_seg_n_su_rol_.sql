-- Actualizar el límite de almacenamiento para Super Admins
UPDATE public.profiles
SET storage_limit_mb = 10240
WHERE role = 'super_admin';

-- Actualizar el límite de almacenamiento para Admins
UPDATE public.profiles
SET storage_limit_mb = 5120
WHERE role = 'admin';

-- Actualizar el límite de almacenamiento para Usuarios normales
UPDATE public.profiles
SET storage_limit_mb = 500
WHERE role = 'user';