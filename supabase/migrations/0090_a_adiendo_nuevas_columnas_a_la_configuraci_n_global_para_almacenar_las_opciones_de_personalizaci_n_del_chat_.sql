-- Add new columns to the global_settings table for chat styling
ALTER TABLE public.global_settings
ADD COLUMN IF NOT EXISTS chat_bubble_background_color TEXT DEFAULT 'hsla(0, 0%, 100%, 0.1)',
ADD COLUMN IF NOT EXISTS chat_bubble_border_color TEXT DEFAULT 'hsla(0, 0%, 100%, 0.2)',
ADD COLUMN IF NOT EXISTS chat_bubble_blur INTEGER DEFAULT 4,
ADD COLUMN IF NOT EXISTS liquid_ether_opacity NUMERIC(2, 1) DEFAULT 0.5;