-- Drop existing user-centric policies on cloudflare_domains
DROP POLICY IF EXISTS "Users can view their own cloudflare domains" ON public.cloudflare_domains;
DROP POLICY IF EXISTS "Users can update their own cloudflare domains" ON public.cloudflare_domains;
DROP POLICY IF EXISTS "Users can delete their own cloudflare domains" ON public.cloudflare_domains;
DROP POLICY IF EXISTS "cloudflare_domains_insert_policy" ON public.cloudflare_domains;

-- Create a new comprehensive policy for super_admin access
CREATE POLICY "super_admin_can_manage_cloudflare_domains"
ON public.cloudflare_domains
FOR ALL
TO authenticated
USING (get_user_role(auth.uid()) = 'super_admin'::text)
WITH CHECK (get_user_role(auth.uid()) = 'super_admin'::text);