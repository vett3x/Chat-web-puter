-- Create the table to store user subscriptions
CREATE TABLE public.user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.pricing_plans(id) ON DELETE CASCADE,
  paypal_order_id TEXT NOT NULL,
  status TEXT NOT NULL, -- e.g., 'completed', 'pending', 'failed'
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) for security
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies for user_subscriptions
-- Users can only see their own subscriptions
CREATE POLICY "Users can view their own subscriptions"
ON public.user_subscriptions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins and Super Admins can see all subscriptions
CREATE POLICY "Admins can view all subscriptions"
ON public.user_subscriptions FOR SELECT
TO authenticated
USING (
  (get_user_role(auth.uid()) = 'admin'::text) OR
  (get_user_role(auth.uid()) = 'super_admin'::text)
);

-- Users can insert their own subscriptions (this will be handled by the server)
CREATE POLICY "Users can insert their own subscriptions"
ON public.user_subscriptions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);