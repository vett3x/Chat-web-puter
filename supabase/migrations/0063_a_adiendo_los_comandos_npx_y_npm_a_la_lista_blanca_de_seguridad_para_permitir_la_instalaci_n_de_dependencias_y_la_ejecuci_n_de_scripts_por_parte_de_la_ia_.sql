-- Allow npx for running package binaries
INSERT INTO public.allowed_commands (command, description)
VALUES ('npx', 'Node Package Execute, used to run package binaries.')
ON CONFLICT (command) DO NOTHING;

-- Allow npm for managing node packages
INSERT INTO public.allowed_commands (command, description)
VALUES ('npm', 'Node Package Manager, used for installing and managing dependencies.')
ON CONFLICT (command) DO NOTHING;