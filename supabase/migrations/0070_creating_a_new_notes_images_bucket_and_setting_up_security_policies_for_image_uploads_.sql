-- Create a new public bucket for note images.
INSERT INTO storage.buckets (id, name, public)
VALUES ('notes-images', 'notes-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to view any image in the bucket.
CREATE POLICY "Authenticated users can view images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'notes-images');

-- Allow authenticated users to upload images into a folder corresponding to their user ID.
CREATE POLICY "Authenticated users can upload their own images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'notes-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to update their own images.
CREATE POLICY "Authenticated users can update their own images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'notes-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to delete their own images.
CREATE POLICY "Authenticated users can delete their own images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'notes-images' AND (storage.foldername(name))[1] = auth.uid()::text);