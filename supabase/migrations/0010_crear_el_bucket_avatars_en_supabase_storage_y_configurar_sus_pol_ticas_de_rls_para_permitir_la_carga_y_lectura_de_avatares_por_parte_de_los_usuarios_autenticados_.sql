-- Crear el bucket 'avatars' si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Política para que las imágenes de avatar sean de lectura pública
CREATE POLICY "Avatar images are publicly readable" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- Política para que cualquier usuario autenticado pueda subir su propio avatar
CREATE POLICY "Anyone can upload an avatar if authenticated" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND auth.uid() = owner);

-- Política para que cualquier usuario pueda actualizar su propio avatar
CREATE POLICY "Anyone can update their own avatar" ON storage.objects
FOR UPDATE TO authenticated USING (auth.uid() = owner) WITH CHECK (bucket_id = 'avatars' AND auth.uid() = owner);

-- Política para que cualquier usuario pueda eliminar su propio avatar
CREATE POLICY "Anyone can delete their own avatar" ON storage.objects
FOR DELETE TO authenticated USING (auth.uid() = owner);