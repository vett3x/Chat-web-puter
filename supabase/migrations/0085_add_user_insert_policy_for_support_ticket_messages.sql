CREATE POLICY "Users can insert messages to their own tickets" ON public.support_ticket_messages
FOR INSERT TO authenticated
WITH CHECK (
  (sender_id = auth.uid()) AND
  EXISTS (
    SELECT 1
    FROM public.support_tickets
    WHERE (support_tickets.id = support_ticket_messages.ticket_id) AND (support_tickets.user_id = auth.uid())
  )
);