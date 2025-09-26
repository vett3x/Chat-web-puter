-- Insert additional base commands into the allowed_commands table
-- These commands are necessary for more advanced file manipulation, scripting, and error recovery.
-- The AI's system prompt contains strict rules against misusing powerful commands like 'rm'.
INSERT INTO public.allowed_commands (command, description) VALUES
('ls', 'List directory contents.'),
('cat', 'Display file content.'),
('mkdir', 'Create new directories.'),
('touch', 'Create new empty files.'),
('rm', 'Remove files or directories. DANGER: Use with caution. Primarily for cache cleaning (e.g., node_modules).'),
('echo', 'Display a line of text, often used for scripting.'),
('node', 'Node.js runtime, for executing scripts.'),
('sh', 'Standard command language interpreter.'),
('bash', 'GNU Bourne-Again SHell interpreter.'),
('pkill', 'Signal processes based on name (e.g., to stop a running server).'),
('nohup', 'Run a command immune to hangups (for running background processes).')
ON CONFLICT (command) DO NOTHING;