-- Add the 'mode' column to the paypal_configs table
ALTER TABLE public.paypal_configs
ADD COLUMN mode TEXT NOT NULL DEFAULT 'sandbox';