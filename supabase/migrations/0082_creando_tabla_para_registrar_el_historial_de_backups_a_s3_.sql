CREATE TABLE public.s3_backup_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL, -- 'success', 'failed'
  details TEXT,
  duration_seconds INTEGER,
  apps_backed_up INTEGER,
  total_size_bytes BIGINT
);

ALTER TABLE public.s3_backup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage s3 backup logs"
ON public.s3_backup_logs
FOR ALL
TO authenticated
USING ( (get_user_role(auth.uid()) = 'super_admin'::text) )
WITH CHECK ( (get_user_role(auth.uid()) = 'super_admin'::text) );