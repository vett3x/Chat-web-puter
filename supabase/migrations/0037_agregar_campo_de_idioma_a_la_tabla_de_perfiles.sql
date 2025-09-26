-- Agregar campo de idioma a la tabla profiles
ALTER TABLE public.profiles 
ADD COLUMN language TEXT DEFAULT 'es' CHECK (language IN ('ar', 'zh', 'zh-tw', 'hr', 'nl', 'en', 'fr', 'de', 'he', 'is', 'it', 'ja', 'ko', 'no', 'pl', 'pt', 'ru', 'sk', 'es', 'uk', 'vi'));

-- Actualizar usuarios existentes para que tengan español por defecto
UPDATE public.profiles SET language = 'es' WHERE language IS NULL;