-- Eliminar las políticas de inserción existentes para poder reemplazarlas
DROP POLICY IF EXISTS "insert_user_images" ON storage.objects;
DROP POLICY IF EXISTS "insert_user_images_with_limits" ON storage.objects;

-- Crear una nueva política de inserción más restrictiva y corregida
CREATE POLICY "insert_user_images_with_limits"
ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'notes-images'
  AND auth.uid()::text = (storage.foldername(name))[1] -- CAST UUID to TEXT
  AND (metadata->>'size')::bigint <= 5242880 -- Límite de 5MB
  AND (metadata->>'mimetype')::text IN (
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain',
    'text/markdown',
    'application/pdf'
  )
);