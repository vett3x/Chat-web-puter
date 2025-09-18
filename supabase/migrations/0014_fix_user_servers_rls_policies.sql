-- Drop existing policies if they exist to ensure a clean slate.
-- Using "if exists" is safe even if they don't exist.
DROP POLICY IF EXISTS "Allow authenticated users to select their own servers" ON "public"."user_servers";
DROP POLICY IF EXISTS "Allow authenticated users to insert their own servers" ON "public"."user_servers";
DROP POLICY IF EXISTS "Allow authenticated users to update their own servers" ON "public"."user_servers";
DROP POLICY IF EXISTS "Allow authenticated users to delete their own servers" ON "public"."user_servers";

-- Ensure RLS is enabled on the table
ALTER TABLE "public"."user_servers" ENABLE ROW LEVEL SECURITY;

-- Create a policy for SELECT
-- This allows a user to read a server's details if the user_id matches their own.
CREATE POLICY "Allow authenticated users to select their own servers"
ON "public"."user_servers"
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create a policy for INSERT
-- This allows a user to add a new server, automatically setting the user_id to their own.
CREATE POLICY "Allow authenticated users to insert their own servers"
ON "public"."user_servers"
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create a policy for UPDATE
-- This allows a user to update a server they own.
CREATE POLICY "Allow authenticated users to update their own servers"
ON "public"."user_servers"
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Create a policy for DELETE
-- This allows a user to delete a server they own.
CREATE POLICY "Allow authenticated users to delete their own servers"
ON "public"."user_servers"
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);