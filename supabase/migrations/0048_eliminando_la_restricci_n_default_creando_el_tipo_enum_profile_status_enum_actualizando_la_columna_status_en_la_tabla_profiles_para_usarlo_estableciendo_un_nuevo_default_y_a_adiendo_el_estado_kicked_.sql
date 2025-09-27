-- 1. Eliminar la restricción DEFAULT actual de la columna 'status'
ALTER TABLE public.profiles ALTER COLUMN status DROP DEFAULT;

-- 2. Crear el nuevo tipo ENUM con los valores existentes
CREATE TYPE public.profile_status_enum AS ENUM ('active', 'banned');

-- 3. Alterar la tabla profiles para cambiar la columna status al nuevo tipo ENUM
-- Esto convierte los valores de texto existentes al nuevo tipo enum.
ALTER TABLE public.profiles
ALTER COLUMN status TYPE public.profile_status_enum
USING status::public.profile_status_enum;

-- 4. Establecer una nueva restricción DEFAULT para la columna 'status'
ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'active'::public.profile_status_enum;

-- 5. Añadir el nuevo valor 'kicked' al tipo ENUM
ALTER TYPE public.profile_status_enum ADD VALUE 'kicked';