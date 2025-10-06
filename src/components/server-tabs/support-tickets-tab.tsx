"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Trash2, LifeBuoy, ChevronDown, ChevronRight, Search, CheckCircle2, MessageSquareText, Eye } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { SupportTicketDetailDialog } from './support-ticket-detail-dialog'; // Import the new dialog

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
    email: { email: string | null } | null;
  } | null;
}

const RESOLVED_TICKETS_INITIAL_DISPLAY_COUNT = 5;

export function SupportTicketsTab() {
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'new' | 'in_progress' | 'resolved'>('all');
  const [expandedResolvedSection, setExpandedResolvedSection] = useState(false);
  const [resolvedTicketsDisplayCount, setResolvedTicketsDisplayCount] = useState(RESOLVED_TICKETS_INITIAL_DISPLAY_COUNT);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/support-tickets');
      if (!response.ok) throw new Error((await response.json()).message);
      setAllTickets(await response.json());
    } catch (err: any) {
      toast.error(`Error al cargar tickets: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    let tempTickets = allTickets;

    if (filterStatus !== 'all') {
      tempTickets = tempTickets.filter(ticket => ticket.status === filterStatus);
    }

    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      tempTickets = tempTickets.filter(ticket =>
        ticket.subject.toLowerCase().includes(lowerCaseSearchTerm) ||
        ticket.description.toLowerCase().includes(lowerCaseSearchTerm) ||
        (ticket.user?.first_name && ticket.user.first_name.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (ticket.user?.last_name && ticket.user.last_name.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (ticket.user?.email?.email && ticket.user.email.email.toLowerCase().includes(lowerCaseSearchTerm))
      );
    }

    setFilteredTickets(tempTickets);
  }, [allTickets, searchTerm, filterStatus]);

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

  const activeTickets = filteredTickets.filter(t => t.status === 'new' || t.status === 'in_progress');
  const resolvedTickets = filteredTickets.filter(t => t.status === 'resolved');
  const displayedResolvedTickets = resolvedTickets.slice(0, resolvedTicketsDisplayCount);

  const handleLoadMoreResolvedTickets = () => {
    setResolvedTicketsDisplayCount(prev => prev + RESOLVED_TICKETS_INITIAL_DISPLAY_COUNT);
  };

  const handleOpenTicketDetails = (id: string) => {
    setSelectedTicketId(id);
    setIsDetailDialogOpen(true);
  };

  const renderTicketTable = (tickets: Ticket[]) => (
    <div className="hidden md:block">
      <Table>
        <TableHeader><TableRow><TableHead className="w-10"></TableHead><TableHead>Asunto</TableHead><TableHead>Usuario</TableHead><TableHead>Prioridad</TableHead><TableHead>Estado</TableHead><TableHead>Fecha</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
        <TableBody>
          {tickets.map(ticket => (
            <TableRow key={ticket.id}>
              <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenTicketDetails(ticket.id)}><Eye className="h-4 w-4" /></Button></TableCell>
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
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const renderTicketCards = (tickets: Ticket[]) => (
    <div className="md:hidden space-y-4">
      {tickets.map(ticket => (
        <Card key={ticket.id}>
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between items-start">
              <h4 className="font-semibold break-all">{ticket.subject}</h4>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => handleOpenTicketDetails(ticket.id)}><Eye className="h-4 w-4" /></Button>
            </div>
            <p className="text-sm text-muted-foreground">Usuario: {ticket.user?.first_name || ticket.user?.email?.email || 'N/A'}</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">Prioridad:</span> {getPriorityBadge(ticket.priority)}
              <span className="font-medium">Estado:</span> {getStatusBadge(ticket.status)}
            </div>
            <p className="text-xs text-muted-foreground">Fecha: {format(new Date(ticket.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
          </CardContent>
          <CardFooter className="p-4 pt-0 flex justify-end">
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
          </CardFooter>
        </Card>
      ))}
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><LifeBuoy className="h-6 w-6" /> Tickets de Soporte</CardTitle>
        <Button variant="ghost" size="icon" onClick={fetchTickets} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar tickets..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} disabled={isLoading} />
          </div>
          <Select value={filterStatus} onValueChange={(value: 'all' | 'new' | 'in_progress' | 'resolved') => setFilterStatus(value)} disabled={isLoading}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filtrar por estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los Estados</SelectItem>
              <SelectItem value="new">Nuevos</SelectItem>
              <SelectItem value="in_progress">En Progreso</SelectItem>
              <SelectItem value="resolved">Resueltos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
          <>
            {activeTickets.length === 0 && resolvedTickets.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No hay tickets de soporte que coincidan con tu búsqueda.</div>
            ) : (
              <>
                {activeTickets.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-muted-foreground" /> Tickets Activos ({activeTickets.length})</h3>
                    {renderTicketTable(activeTickets)}
                    {renderTicketCards(activeTickets)}
                  </div>
                )}

                {resolvedTickets.length > 0 && (
                  <>
                    <Separator className="my-8" />
                    <Collapsible open={expandedResolvedSection} onOpenChange={setExpandedResolvedSection}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="w-full justify-start text-lg font-semibold flex items-center gap-2">
                          {expandedResolvedSection ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                          <CheckCircle2 className="h-5 w-5 text-green-500" /> Tickets Resueltos ({resolvedTickets.length})
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-4">
                        {renderTicketTable(displayedResolvedTickets)}
                        {renderTicketCards(displayedResolvedTickets)}
                        {resolvedTicketsDisplayCount < resolvedTickets.length && (
                          <div className="flex justify-center mt-4">
                            <Button variant="outline" onClick={handleLoadMoreResolvedTickets} disabled={isLoading}>
                              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Cargar más ({resolvedTickets.length - resolvedTicketsDisplayCount} restantes)
                            </Button>
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  </>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
      {selectedTicketId && (
        <SupportTicketDetailDialog
          open={isDetailDialogOpen}
          onOpenChange={setIsDetailDialogOpen}
          ticketId={selectedTicketId}
          onTicketUpdated={fetchTickets}
        />
      )}
    </Card>
  );
}