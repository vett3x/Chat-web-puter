"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Loader2, Send, LifeBuoy, User, MessageSquareText, Clock, AlertCircle, CheckCircle2, Shield } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useSession } from '@/components/session-context-provider';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Switch } from '@/components/ui/switch'; // Import Switch

interface TicketUser {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface TicketMessage {
  id: string;
  created_at: string;
  content: string;
  is_internal_note: boolean;
  sender: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
}

interface Ticket {
  id: string;
  created_at: string;
  subject: string;
  description: string;
  status: 'new' | 'in_progress' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  user_id: string;
  user: TicketUser;
  messages: TicketMessage[];
}

const messageSchema = z.object({
  content: z.string().min(1, 'El mensaje no puede estar vacío.'),
  is_internal_note: z.boolean().default(false), // Eliminado .optional()
});

type MessageFormValues = z.infer<typeof messageSchema>;

const updateTicketSchema = z.object({
  status: z.enum(['new', 'in_progress', 'resolved']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
});

type UpdateTicketFormValues = z.infer<typeof updateTicketSchema>;

interface SupportTicketDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string | null;
  onTicketUpdated: () => void; // Callback to refresh the list in parent
}

export function SupportTicketDetailDialog({ open, onOpenChange, ticketId, onTicketUpdated }: SupportTicketDetailDialogProps) {
  const { session } = useSession();
  const currentUserId = session?.user?.id;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isUpdatingTicket, setIsUpdatingTicket] = useState(false);

  const messagesScrollAreaRef = useRef<HTMLDivElement>(null);

  const messageForm = useForm<MessageFormValues>({
    resolver: zodResolver(messageSchema),
    defaultValues: { content: '', is_internal_note: false },
  });

  const updateForm = useForm<UpdateTicketFormValues>({
    resolver: zodResolver(updateTicketSchema),
    defaultValues: { status: 'new', priority: 'medium' },
  });

  const fetchTicketDetails = useCallback(async () => {
    if (!ticketId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/support-tickets/${ticketId}`);
      if (!response.ok) throw new Error((await response.json()).message);
      const data: Ticket = await response.json();
      setTicket(data);
      updateForm.reset({ status: data.status, priority: data.priority });
    } catch (err: any) {
      toast.error(`Error al cargar el ticket: ${err.message}`);
      setTicket(null);
    } finally {
      setIsLoading(false);
    }
  }, [ticketId, updateForm]);

  useEffect(() => {
    if (open && ticketId) {
      fetchTicketDetails();
    } else if (!open) {
      setTicket(null); // Clear ticket data when dialog closes
    }
  }, [open, ticketId, fetchTicketDetails]);

  useEffect(() => {
    // Scroll to bottom of messages when new messages arrive
    if (messagesScrollAreaRef.current) {
      const viewport = messagesScrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [ticket?.messages]);

  const handleSendMessage = async (values: MessageFormValues) => {
    if (!ticketId || !currentUserId) return;
    setIsSendingMessage(true);
    try {
      const response = await fetch(`/api/support-tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error((await response.json()).message);
      toast.success('Mensaje enviado.');
      messageForm.reset({ content: '', is_internal_note: false });
      fetchTicketDetails(); // Refresh to show new message
    } catch (err: any) {
      toast.error(`Error al enviar mensaje: ${err.message}`);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleUpdateTicket = async (values: UpdateTicketFormValues) => {
    if (!ticketId) return;
    setIsUpdatingTicket(true);
    try {
      const response = await fetch(`/api/support-tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error((await response.json()).message);
      toast.success('Ticket actualizado.');
      fetchTicketDetails(); // Refresh to show new status/priority
      onTicketUpdated(); // Notify parent to refresh list
    } catch (err: any) {
      toast.error(`Error al actualizar ticket: ${err.message}`);
    } finally {
      setIsUpdatingTicket(false);
    }
  };

  const getPriorityBadge = (priority: Ticket['priority']) => {
    switch (priority) {
      case 'high': return <Badge variant="destructive">Alta</Badge>;
      case 'medium': return <Badge className="bg-yellow-500 text-white">Media</Badge>;
      case 'low': return <Badge variant="outline">Baja</Badge>;
    }
  };

  const getStatusBadge = (status: Ticket['status']) => {
    switch (status) {
      case 'new': return <Badge className="bg-blue-500 text-white">Nuevo</Badge>;
      case 'in_progress': return <Badge className="bg-purple-500 text-white">En Progreso</Badge>;
      case 'resolved': return <Badge className="bg-green-500 text-white">Resuelto</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px] h-[90vh] flex flex-col">
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-2 text-muted-foreground">Cargando ticket...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!ticket) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px] h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>Ticket no encontrado</DialogTitle></DialogHeader>
          <div className="flex items-center justify-center h-full text-destructive">
            <AlertCircle className="h-6 w-6 mr-2" />
            <p>No se pudo cargar el ticket de soporte.</p>
          </div>
          <DialogFooter><DialogClose asChild><Button variant="outline">Cerrar</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy className="h-6 w-6" /> Ticket #{ticket.id.substring(0, 8)} - {ticket.subject}
          </DialogTitle>
          <DialogDescription>
            Gestiona los detalles y el progreso de este ticket de soporte.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 py-4 overflow-hidden flex flex-col">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Usuario: {ticket.user.first_name} {ticket.user.last_name} ({ticket.user.email})
              </p>
              <p className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Creado: {format(new Date(ticket.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="flex items-center gap-1">
                  Prioridad: {getPriorityBadge(ticket.priority)}
                </Badge>
                <Badge variant="secondary" className="flex items-center gap-1">
                  Estado: {getStatusBadge(ticket.status)}
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <Form {...updateForm}>
                <form onSubmit={updateForm.handleSubmit(handleUpdateTicket)} className="space-y-2">
                  <FormField control={updateForm.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isUpdatingTicket}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Cambiar estado" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="new">Nuevo</SelectItem>
                          <SelectItem value="in_progress">En Progreso</SelectItem>
                          <SelectItem value="resolved">Resuelto</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={updateForm.control} name="priority" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prioridad</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isUpdatingTicket}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Cambiar prioridad" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="low">Baja</SelectItem>
                          <SelectItem value="medium">Media</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" size="sm" disabled={isUpdatingTicket}>
                    {isUpdatingTicket ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Guardar Cambios
                  </Button>
                </form>
              </Form>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="flex-1 flex flex-col min-h-0">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <MessageSquareText className="h-5 w-5 text-muted-foreground" /> Hilo del Ticket
            </h3>
            <ScrollArea className="flex-1 border rounded-md p-4 bg-muted/20" ref={messagesScrollAreaRef}>
              <div className="space-y-4">
                {/* Initial Description */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="bg-primary text-primary-foreground rounded-lg p-3 max-w-[85%]">
                    <p className="font-semibold">{ticket.user.first_name} {ticket.user.last_name} ({ticket.user.email})</p>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{ticket.description}</p>
                    <p className="text-xs text-primary-foreground/70 mt-2">{format(new Date(ticket.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
                  </div>
                </div>

                {/* Messages/Notes */}
                {ticket.messages.map(msg => (
                  <div key={msg.id} className={cn("flex items-start gap-3", msg.is_internal_note ? "justify-end" : "justify-start")}>
                    <div className={cn("flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center", msg.is_internal_note ? "bg-blue-500 text-white" : "bg-secondary text-secondary-foreground")}>
                      {msg.is_internal_note ? <Shield className="h-4 w-4" /> : <LifeBuoy className="h-4 w-4" />}
                    </div>
                    <div className={cn("rounded-lg p-3 max-w-[85%]", msg.is_internal_note ? "bg-blue-500 text-white" : "bg-muted")}>
                      <p className="font-semibold">
                        {msg.is_internal_note ? 'Nota Interna' : 'Respuesta de Soporte'} de {msg.sender.first_name} {msg.sender.last_name} ({msg.sender.email})
                      </p>
                      <div className="prose prose-sm dark:prose-invert max-w-none mt-1 text-sm">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                      <p className={cn("text-xs mt-2", msg.is_internal_note ? "text-blue-100" : "text-muted-foreground")}>
                        {format(new Date(msg.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="mt-4">
              <Form {...messageForm}>
                <form onSubmit={messageForm.handleSubmit(handleSendMessage)} className="space-y-2">
                  <FormField control={messageForm.control} name="content" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Añadir Nota Interna</FormLabel>
                      <FormControl><Textarea placeholder="Escribe tu nota aquí..." {...field} disabled={isSendingMessage} rows={3} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={messageForm.control} name="is_internal_note" render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Marcar como nota interna</FormLabel>
                        <FormDescription>
                          Si está activado, este mensaje solo será visible para el equipo de soporte.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isSendingMessage}
                        />
                      </FormControl>
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={isSendingMessage}>
                    {isSendingMessage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Enviar Nota
                  </Button>
                </form>
              </Form>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cerrar</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}