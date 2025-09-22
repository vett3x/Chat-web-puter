"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, MessageSquare, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Conversation {
  id: string;
  title: string;
  model: string | null;
  created_at: string;
  folder_name: string;
}

interface UserConversationsTabProps {
  userId: string;
}

export function UserConversationsTab({ userId }: UserConversationsTabProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserConversations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/users/${userId}/conversations`, { credentials: 'include' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: Conversation[] = await response.json();
      setConversations(data);
    } catch (err: any) {
      console.error(`Error fetching conversations for user ${userId}:`, err);
      setError(err.message || 'Error al cargar las conversaciones del usuario.');
      toast.error(err.message || 'Error al cargar las conversaciones del usuario.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchUserConversations();
    }
  }, [userId, fetchUserConversations]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" /> Conversaciones
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={fetchUserConversations} disabled={isLoading} title="Refrescar">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden pt-0">
        {isLoading && conversations.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Cargando conversaciones...</p>
          </div>
        ) : error && conversations.length === 0 ? (
          <div className="flex items-center justify-center h-full text-destructive">
            <AlertCircle className="h-6 w-6 mr-2" />
            <p>{error}</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>Este usuario no tiene conversaciones.</p>
          </div>
        ) : (
          <ScrollArea className="h-full w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Carpeta</TableHead>
                  <TableHead>Creado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversations.map((conv) => (
                  <TableRow key={conv.id}>
                    <TableCell className="font-medium">{conv.title}</TableCell>
                    <TableCell>{conv.model || 'N/A'}</TableCell>
                    <TableCell>{conv.folder_name}</TableCell>
                    <TableCell className="text-xs">{format(new Date(conv.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}