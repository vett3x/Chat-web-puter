-- Add a 'status' column to track the provisioning state of the server
ALTER TABLE public.user_servers
ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';

-- Add a check constraint to ensure the status is one of the allowed values
ALTER TABLE public.user_servers
ADD CONSTRAINT chk_status CHECK (status IN ('pending', 'provisioning', 'ready', 'failed'));

-- Add a 'provisioning_log' column to store the output of the installation script
ALTER TABLE public.user_servers
ADD COLUMN provisioning_log TEXT;

-- Update existing servers to 'ready' status, assuming they are already set up
UPDATE public.user_servers
SET status = 'ready'
WHERE status = 'pending';

-- Create a function to append to the provisioning log for real-time updates
CREATE OR REPLACE FUNCTION append_to_provisioning_log(server_id uuid, log_content text)
RETURNS void AS $$
BEGIN
  UPDATE public.user_servers
  SET provisioning_log = COALESCE(provisioning_log, '') || log_content
  WHERE id = server_id;
END;
$$ LANGUAGE plpgsql;