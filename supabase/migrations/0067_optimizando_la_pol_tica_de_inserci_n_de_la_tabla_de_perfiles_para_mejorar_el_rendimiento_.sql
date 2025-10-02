-- Drop the existing, non-performant insert policy for the profiles table
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;

-- Recreate the insert policy using the optimized (select auth.uid()) pattern
CREATE POLICY "profiles_insert_policy" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (((select auth.uid()) = id));