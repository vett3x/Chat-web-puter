-- Create a new public bucket for app assets like logos and backgrounds
INSERT INTO storage.buckets (id, name, public)
VALUES ('app_assets', 'app_assets', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for the app_assets bucket
-- Allow public read access
CREATE POLICY "Public read access for app_assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'app_assets');

-- Restrict insert/update/delete to super admins (will be enforced in API)
-- Note: RLS for storage is complex, primary enforcement will be in API logic.
-- This policy is a safeguard.
CREATE POLICY "Super Admins can manage app_assets"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'app_assets' AND
  (select role from public.profiles where id = auth.uid()) = 'super_admin'
)
WITH CHECK (
  bucket_id = 'app_assets' AND
  (select role from public.profiles where id = auth.uid()) = 'super_admin'
);