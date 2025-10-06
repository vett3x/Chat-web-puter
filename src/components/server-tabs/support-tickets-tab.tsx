"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Trash2, LifeBuoy, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';

interface Ticket {
  id: string;
  created_at: string;
  subject: string;
  description: string;
  status: 'new' | 'in_progress' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  user: {
    first_name: string | null;
    last_name: string | null;
    email: { email: string } | null;
  } | null;
}

export function SupportTicketsTab() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/support-tickets');
      if (!response.ok) throw new Error((await response.json()).message);
      setTickets(await response.json());
    } catch (err: any) {
      toast.error(`Error al cargar tickets: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleStatusChange = async (id: string, status: Ticket['status']) => {
    try {
      const response = await fetch(`/api/support-tickets?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error((await response.json()).message);
      toast.success('Estado del ticket actualizado.');
      fetchTickets();
    } catch (err: any) {
      toast.error(`Error al actualizar: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/support-tickets?id=${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error((await response.json()).message);
      toast.success('Ticket eliminado.');
      fetchTickets();
    } catch (err: any) {
      toast.error(`Error al eliminar: ${err.message}`);
    }
  };

  const getPriorityBadge = (priority: Ticket['priority']) => {
    switch (priority) {
      case 'high': return <Badge variant="destructive">Alta</Badge>;
      case 'medium': return <Badge variant="secondary" className="bg-yellow-500 text-white">Media</Badge>;
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><LifeBuoy className="h-6 w-6" /> Tickets de Soporte</CardTitle>
        <Button variant="ghost" size="icon" onClick={fetchTickets} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
          <Table>
            <TableHeader><TableRow><TableHead className="w-10"></TableHead><TableHead>Asunto</TableHead><TableHead>Usuario</TableHead><TableHead>Prioridad</TableHead><TableHead>Estado</TableHead><TableHead>Fecha</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
            <TableBody>
              {tickets.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No hay tickets de soporte.</TableCell></TableRow> : tickets.map(ticket => (
                <React.Fragment key={ticket.id}>
                  <TableRow>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedTicketId(expandedTicketId === ticket.id ? null : ticket.id)}>
                        {expandedTicketId === ticket.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">{ticket.subject}</TableCell>
                    <TableCell>{ticket.user?.first_name || ticket.user?.email?.email || 'Usuario Desconocido'}</TableCell>
                    <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                    <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                    <TableCell>{format(new Date(ticket.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="outline" size="sm">Acciones</Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleStatusChange(ticket.id, 'new')}>Marcar como Nuevo</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(ticket.id, 'in_progress')}>Marcar como En Progreso</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(ticket.id, 'resolved')}>Marcar como Resuelto</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">Eliminar</DropdownMenuItem></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>¿Eliminar ticket?</AlertDialogTitle><AlertDialogDescription>Esta acción es irreversible.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(ticket.id)} className="bg-destructive">Eliminar</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  {expandedTicketId === ticket.id && (
                    <TableRow>
                      <TableCell colSpan={7} className="p-4 bg-muted/50">
                        <p className="whitespace-pre-wrap">{ticket.description}</p>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}