"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/integrations/supabase/client';
import { ChatInterface } from '@/components/chat-interface';
import { AppPreview } from '@/components/app-builder/app-preview';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSession } from '@/components/session-context-provider';

export default function AppDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { session } = useSession();
  const appId = params.id as string;
  
  const [app, setApp] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    loadApp();
  }, [appId]);

  const loadApp = async () => {
    try {
      const { data, error } = await supabase
        .from('user_apps')
        .select('*')
        .eq('id', appId)
        .single();

      if (error) throw error;
      
      setApp(data);
      setConversationId(data.conversation_id);
    } catch (error) {
      console.error('Error loading app:', error);
      toast.error('Error al cargar la aplicación');
      router.push('/apps');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/apps/${appId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al eliminar la aplicación');
      }

      toast.success('Aplicación eliminada correctamente');
      router.push('/apps');
    } catch (error) {
      console.error('Error deleting app:', error);
      toast.error(error instanceof Error ? error.message : 'Error al eliminar la aplicación');
      setIsDeleting(false);
    }
  };

  const handleWriteFiles = useCallback(async (files: { path: string; content: string }[]) => {
    console.log('[AppDetailPage] handleWriteFiles called with files:', files);
    
    // Call the writeFiles function from AppPreview
    if ((window as any).appPreviewWriteFiles) {
      console.log('[AppDetailPage] Calling appPreviewWriteFiles');
      await (window as any).appPreviewWriteFiles(files);
    } else {
      console.error('[AppDetailPage] appPreviewWriteFiles not found on window');
      
      // Fallback: Call the API directly
      console.log('[AppDetailPage] Using fallback API call');
      try {
        const response = await fetch(`/api/apps/${appId}/files`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ files }),
        });

        const data = await response.json();
        console.log('[AppDetailPage] Fallback API response:', data);

        if (!response.ok) {
          throw new Error(data.message || 'Error al escribir archivos');
        }

        toast.success(`${files.length} archivo(s) guardado(s) correctamente`);
      } catch (error) {
        console.error('[AppDetailPage] Error in fallback file write:', error);
        toast.error(`Error al escribir archivos: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      }
    }
  }, [appId]);

  const handleNewConversationCreated = (newConversationId: string) => {
    setConversationId(newConversationId);
  };

  const handleConversationTitleUpdate = (conversationId: string, newTitle: string) => {
    // Handle title update if needed
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!app) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/apps')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold">{app.name}</h1>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShowDeleteDialog(true)}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Eliminar
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 border-r">
          <ChatInterface
            userId={session?.user?.id}
            conversationId={conversationId}
            onNewConversationCreated={handleNewConversationCreated}
            onConversationTitleUpdate={handleConversationTitleUpdate}
            aiResponseSpeed="normal"
            isAppProvisioning={app.status === 'provisioning'}
            isAppDeleting={isDeleting}
            appPrompt={app.prompt}
            appId={appId}
            onWriteFiles={handleWriteFiles}
          />
        </div>
        <div className="w-1/2">
          <AppPreview
            appId={appId}
            appUrl={app.url}
            isProvisioning={app.status === 'provisioning'}
            isDeleting={isDeleting}
            onRefresh={loadApp}
          />
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la aplicación "{app.name}" y todos sus recursos asociados.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}