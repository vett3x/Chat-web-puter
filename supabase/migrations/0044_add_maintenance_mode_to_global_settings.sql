-- Add maintenance_mode_enabled column to global_settings
ALTER TABLE public.global_settings
ADD COLUMN maintenance_mode_enabled BOOLEAN DEFAULT FALSE NOT NULL;

-- Update RLS policies for global_settings to include the new column
-- (Existing policies already cover SELECT and UPDATE for super_admin, so no explicit change needed for RLS on the new column,
-- but it's good practice to ensure the policies are robust for all columns.)

-- Update the initial data if it exists, or insert if not (ensuring only one row)
INSERT INTO public.global_settings (id, security_enabled, maintenance_mode_enabled)
VALUES ('00000000-0000-0000-0000-000000000000', TRUE, FALSE)
ON CONFLICT (id) DO UPDATE SET maintenance_mode_enabled = EXCLUDED.maintenance_mode_enabled;