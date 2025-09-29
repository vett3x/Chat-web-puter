"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, MessageSquare, RefreshCw, AlertCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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
import { useSession } from '@/components/session-context-provider'; // Import useSession

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
  const { userRole } = useSession(); // Get current user's role
  const isModerator = userRole === 'admin' || userRole === 'super_admin';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isDeletingSingle, setIsDeletingSingle] = useState<string | null>(null);

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

  const handleDeleteAllConversations = async () => {
    setIsDeletingAll(true);
    try {
      const response = await fetch(`/api/users/${userId}/conversations`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }
      toast.success(result.message || 'Todas las conversaciones eliminadas correctamente.');
      fetchUserConversations(); // Refresh the list
    } catch (err: any) {
      console.error('Error deleting all conversations:', err);
      toast.error(err.message || 'Error al eliminar todas las conversaciones.');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleDeleteSingleConversation = async (conversationId: string) => {
    setIsDeletingSingle(conversationId);
    try {
      const response = await fetch(`/api/users/${userId}/conversations/${conversationId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }
      toast.success(result.message || 'Conversación eliminada correctamente.');
      fetchUserConversations(); // Refresh the list
    } catch (err: any) {
      console.error(`Error deleting conversation ${conversationId}:`, err);
      toast.error(err.message || 'Error al eliminar la conversación.');
    } finally {
      setIsDeletingSingle(null);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" /> Conversaciones
        </CardTitle>
        <div className="flex items-center gap-2">
          {isModerator && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isLoading || isDeletingAll || conversations.length === 0}>
                  {isDeletingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Eliminar Todo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Estás seguro de eliminar todas las conversaciones?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción eliminará permanentemente todas las conversaciones y sus mensajes para este usuario. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAllConversations} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Eliminar Todo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="ghost" size="icon" onClick={fetchUserConversations} disabled={isLoading || isDeletingAll || isDeletingSingle !== null} title="Refrescar">
            {isLoading || isDeletingAll || isDeletingSingle !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
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
                  {isModerator && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversations.map((conv) => (
                  <TableRow key={conv.id}>
                    <TableCell className="font-medium">{conv.title}</TableCell>
                    <TableCell>{conv.model || 'N/A'}</TableCell>
                    <TableCell>{conv.folder_name}</TableCell>
                    <TableCell className="text-xs">{format(new Date(conv.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</TableCell>
                    {isModerator && (
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" className="h-8 w-8" disabled={isDeletingSingle === conv.id}>
                              {isDeletingSingle === conv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Estás seguro de eliminar esta conversación?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción eliminará permanentemente la conversación "{conv.title}" y todos sus mensajes. Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteSingleConversation(conv.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    )}
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