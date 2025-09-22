ALTER TABLE public.cloudflare_domains
ADD COLUMN account_id TEXT;

-- Make account_id NOT NULL and add a default value if existing rows need it
-- If there are existing rows, you might need to update them first:
-- UPDATE public.cloudflare_domains SET account_id = 'YOUR_DEFAULT_ACCOUNT_ID' WHERE account_id IS NULL;
ALTER TABLE public.cloudflare_domains
ALTER COLUMN account_id SET NOT NULL;