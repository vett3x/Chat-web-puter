-- Schedule the function to run every minute
SELECT cron.schedule(
    'auto-unkick-users-job',
    '* * * * *', -- every minute
    'SELECT public.auto_unkick_users();'
);