-- Create the support_tickets table
CREATE TABLE public.support_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new', -- e.g., 'new', 'in_progress', 'resolved'
    priority TEXT NOT NULL DEFAULT 'medium' -- e.g., 'low', 'medium', 'high'
);

-- Enable Row Level Security
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Policies for users
CREATE POLICY "Users can insert their own support tickets"
ON public.support_tickets
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own support tickets"
ON public.support_tickets
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Policies for admins/super_admins
CREATE POLICY "Admins can view all support tickets"
ON public.support_tickets
FOR SELECT TO authenticated
USING (get_user_role(auth.uid()) IN ('admin', 'super_admin'));

CREATE POLICY "Admins can update all support tickets"
ON public.support_tickets
FOR UPDATE TO authenticated
USING (get_user_role(auth.uid()) IN ('admin', 'super_admin'));

CREATE POLICY "Admins can delete all support tickets"
ON public.support_tickets
FOR DELETE TO authenticated
USING (get_user_role(auth.uid()) IN ('admin', 'super_admin'));