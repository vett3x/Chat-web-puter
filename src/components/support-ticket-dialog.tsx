"use client";

import React, { useState } from 'react';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';

const ticketSchema = z.object({
  subject: z.string().min(5, 'El asunto debe tener al menos 5 caracteres.').max(100, 'El asunto no puede exceder los 100 caracteres.'),
  description: z.string().min(20, 'La descripción debe tener al menos 20 caracteres.').max(2000, 'La descripción no puede exceder los 2000 caracteres.'),
  priority: z.enum(['low', 'medium', 'high']),
});

type TicketFormValues = z.infer<typeof ticketSchema>;

interface SupportTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupportTicketDialog({ open, onOpenChange }: SupportTicketDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      subject: '',
      description: '',
      priority: 'medium',
    },
  });

  const onSubmit = async (values: TicketFormValues) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/support-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success('Ticket de soporte enviado. Nos pondremos en contacto contigo pronto.');
      form.reset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Error al enviar el ticket: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Abrir un Ticket de Soporte</DialogTitle>
          <DialogDescription>
            Describe el problema que estás experimentando. Nuestro equipo lo revisará lo antes posible.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField control={form.control} name="subject" render={({ field }) => (
              <FormItem>
                <FormLabel>Asunto</FormLabel>
                <FormControl><Input placeholder="Ej: Error al cargar archivos en una nota" {...field} disabled={isSubmitting} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Descripción Detallada</FormLabel>
                <FormControl><Textarea placeholder="Por favor, describe el problema con la mayor cantidad de detalles posible, incluyendo los pasos para reproducirlo." {...field} disabled={isSubmitting} rows={6} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="priority" render={({ field }) => (
              <FormItem>
                <FormLabel>Prioridad</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecciona una prioridad" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancelar</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting} className="bg-primary-light-purple hover:bg-primary-light-purple/90 text-white">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Enviar Ticket
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}