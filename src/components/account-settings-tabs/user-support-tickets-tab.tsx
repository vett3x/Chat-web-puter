"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, LifeBuoy, Eye, MessageSquareText } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { useSession } from '@/components/session-context-provider';
import { UserSupportTicketDetailDialog } from './user-support-ticket-detail-dialog'; // Import the new dialog

interface Ticket {
  id: string;
  created_at: string;
  subject: string;
  description: string;
  status: 'new' | 'in_progress' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  user_id: string;
}

interface UserSupportTicketsTabProps {
  userId: string;
}

export function UserSupportTicketsTab({ userId }: UserSupportTicketsTabProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/users/${userId}/support-tickets`);
      if (!response.ok) throw new Error((await response.json()).message);
      setTickets(await response.json());
    } catch (err: any) {
      toast.error(`Error al cargar tus tickets: ${err.message}`);
      setError(err.message || 'Error al cargar tus tickets de soporte.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchTickets();
    }
  }, [userId, fetchTickets]);

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

  const handleOpenTicketDetails = (id: string) => {
    setSelectedTicketId(id);
    setIsDetailDialogOpen(true);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <LifeBuoy className="h-5 w-5" /> Mis Tickets de Soporte
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={fetchTickets} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden pt-0">
        {isLoading && tickets.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Cargando tus tickets...</p>
          </div>
        ) : error && tickets.length === 0 ? (
          <div className="flex items-center justify-center h-full text-destructive">
            <MessageSquareText className="h-6 w-6 mr-2" />
            <p>{error}</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>No has abierto ningún ticket de soporte aún.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Asunto</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map(ticket => (
                <TableRow key={ticket.id}>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenTicketDetails(ticket.id)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                  <TableCell className="font-medium">{ticket.subject}</TableCell>
                  <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                  <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                  <TableCell>{format(new Date(ticket.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {selectedTicketId && (
        <UserSupportTicketDetailDialog
          open={isDetailDialogOpen}
          onOpenChange={setIsDetailDialogOpen}
          ticketId={selectedTicketId}
          onTicketUpdated={fetchTickets} // Refresh list when a ticket is updated
          userId={userId}
        />
      )}
    </Card>
  );
}