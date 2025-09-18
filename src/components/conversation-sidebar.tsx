"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, MessageSquare, Loader2, Edit, Save, X, Trash2 } from 'lucide-react';
import { useSession } from '@/components/session-context-provider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
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
import { ProfileDropdown } from './profile-dropdown'; // Importar el nuevo componente

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

interface ConversationSidebarProps {
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string | null) => void;
  // onNewConversationCreated ya no es una prop de este componente
}

export function ConversationSidebar({
  selectedConversationId,
  onSelectConversation,
}: ConversationSidebarProps) {
  const { session, isLoading: isSessionLoading } = useSession();
  const userId = session?.user?.id;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      fetchConversations();
    } else if (!isSessionLoading) {
      setConversations([]);
      setIsLoadingConversations(false);
    }
  }, [userId, isSessionLoading]);

  // Nuevo useEffect para reaccionar a la creación de conversaciones externas (desde ChatInterface)
  useEffect(() => {
    if (userId && selectedConversationId && !isLoadingConversations) {
      // Verifica si la conversación seleccionada no está en la lista actual
      const isSelectedConversationInList = conversations.some(
        (conv) => conv.id === selectedConversationId
      );
      if (!isSelectedConversationInList) {
        // Si es un nuevo ID no presente en la lista, vuelve a cargar las conversaciones
        fetchConversations();
      }
    }
  }, [selectedConversationId, userId, isLoadingConversations, conversations]); // Añadido 'conversations' a las dependencias

  const fetchConversations = async () => {
    setIsLoadingConversations(true);
    const { data, error } = await supabase
      .from('conversations')
      .select('id, title, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Error al cargar las conversaciones.');
    } else {
      setConversations(data || []);
    }
    setIsLoadingConversations(false);
  };

  const createNewConversation = async () => {
    if (!userId || isCreatingConversation) return;

    setIsCreatingConversation(true);
    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: userId, title: 'Nueva conversación' })
      .select('id, title, created_at')
      .single();

    if (error) {
      console.error('Error creating new conversation:', error);
      toast.error('Error al crear una nueva conversación.');
    } else if (data) {
      setConversations(prev => [data, ...prev]);
      onSelectConversation(data.id);
      toast.success('Nueva conversación creada.');
    }
    setIsCreatingConversation(false);
  };

  const handleEditClick = (conversation: Conversation) => {
    setEditingConversationId(conversation.id);
    setEditingTitle(conversation.title);
  };

  const handleSaveEdit = async (conversationId: string) => {
    if (!editingTitle.trim()) {
      toast.error('El título no puede estar vacío.');
      return;
    }
    const { error } = await supabase
      .from('conversations')
      .update({ title: editingTitle })
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating conversation title:', error);
      toast.error('Error al actualizar el título de la conversación.');
    } else {
      setConversations(prev =>
        prev.map(conv => (conv.id === conversationId ? { ...conv, title: editingTitle } : conv))
      );
      setEditingConversationId(null);
      setEditingTitle('');
      toast.success('Título de conversación actualizado.');
    }
  };

  const handleCancelEdit = () => {
    setEditingConversationId(null);
    setEditingTitle('');
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!userId) {
      toast.error('Usuario no autenticado.');
      return;
    }

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Error al eliminar la conversación.');
    } else {
      // Remove the conversation from the local state
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      
      // If the deleted conversation was the selected one, deselect it
      if (selectedConversationId === conversationId) {
        onSelectConversation(null); 
      }
      
      // Re-fetch conversations to ensure the list is up-to-date and loading state is reset
      // This is crucial if the list becomes empty or if there are other conversations to select.
      await fetchConversations(); 
      
      toast.success('Conversación eliminada.');
    }
    setDeletingConversationId(null); // Reset deleting state
  };

  if (isSessionLoading || isLoadingConversations) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Cargando conversaciones...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 border-r bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Conversaciones</h2>
        <Button
          variant="default"
          size="icon"
          onClick={createNewConversation}
          disabled={isCreatingConversation}
          className="bg-green-500 hover:bg-green-600 text-white animate-pulse-glow rounded-full" // Añadido rounded-full
        >
          {isCreatingConversation ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-2">
          {conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay conversaciones. ¡Crea una nueva!
            </p>
          ) : (
            conversations.map((conversation) => (
              <Card
                key={conversation.id}
                className={cn(
                  "cursor-pointer hover:bg-sidebar-accent transition-colors",
                  selectedConversationId === conversation.id && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary"
                )}
                onClick={() => onSelectConversation(conversation.id)}
              >
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  {editingConversationId === conversation.id ? (
                    <Input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()} // Prevent card click
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveEdit(conversation.id);
                        }
                      }}
                      className="flex-1 bg-sidebar-background text-sidebar-foreground"
                    />
                  ) : (
                    <div className="flex items-center gap-2 flex-1 overflow-hidden">
                      <MessageSquare className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm">{conversation.title}</span>
                    </div>
                  )}
                  <div className="flex-shrink-0 flex gap-1">
                    {editingConversationId === conversation.id ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveEdit(conversation.id);
                          }}
                          className="h-7 w-7 text-sidebar-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelEdit();
                          }}
                          className="h-7 w-7 text-sidebar-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(conversation);
                          }}
                          className={cn(
                            "h-7 w-7",
                            selectedConversationId === conversation.id ? "text-sidebar-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingConversationId(conversation.id);
                              }}
                              className={cn(
                                "h-7 w-7 text-destructive hover:bg-destructive/10",
                                selectedConversationId === conversation.id ? "text-sidebar-primary-foreground hover:bg-sidebar-accent hover:text-destructive" : "text-destructive hover:bg-destructive/10"
                              )}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. Esto eliminará permanentemente tu conversación y todos sus mensajes.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setDeletingConversationId(null)}>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteConversation(conversation.id)}>
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
      <div className="mt-auto pt-4 border-t border-sidebar-border">
        <ProfileDropdown />
      </div>
    </div>
  );
}