-- Create the table to store allowed commands
CREATE TABLE public.allowed_commands (
  command TEXT PRIMARY KEY,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add comments for clarity
COMMENT ON TABLE public.allowed_commands IS 'Stores the whitelist of commands that can be executed in containers via the AI.';
COMMENT ON COLUMN public.allowed_commands.command IS 'The command name (e.g., "npm").';

-- Enable Row Level Security
ALTER TABLE public.allowed_commands ENABLE ROW LEVEL SECURITY;

-- Policies: Only super admins can manage this table.
CREATE POLICY "Super admins can view allowed commands"
ON public.allowed_commands
FOR SELECT
TO authenticated
USING (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Super admins can manage allowed commands"
ON public.allowed_commands
FOR ALL
TO authenticated
USING (get_user_role(auth.uid()) = 'super_admin')
WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

-- Insert default safe commands
INSERT INTO public.allowed_commands (command, description) VALUES
('npm', 'Node Package Manager - Used for managing project dependencies.'),
('npx', 'Node Package Executable - Used for running packages without installing them globally.'),
('yarn', 'Yarn Package Manager - An alternative to npm.'),
('pnpm', 'Performant NPM - Another alternative package manager.');