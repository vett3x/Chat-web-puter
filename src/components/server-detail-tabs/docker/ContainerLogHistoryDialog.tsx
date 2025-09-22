"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { DockerContainer } from '@/types/docker';

interface ContainerLogHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: { id: string };
  container: DockerContainer;
}

export function ContainerLogHistoryDialog({ open, onOpenChange, server, container }: ContainerLogHistoryDialogProps) {
  const [logs, setLogs] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/servers/${server.id}/docker/containers/${container.ID}/logs`);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Error al cargar los logs.');
      }
      setLogs(result.logs);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [server.id, container.ID]);

  useEffect(() => {
    if (open) {
      fetchLogs();
    }
  }, [open, fetchLogs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[80vw] w-[80vw] h-[80vh] flex flex-col p-4">
        <DialogHeader className="px-2 pt-2">
          <DialogTitle>Historial de Logs: {container.Names} ({container.ID.substring(0, 12)})</DialogTitle>
          <DialogDescription>
            Mostrando las últimas 1000 líneas de logs del contenedor.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 w-full h-full bg-black rounded-md my-4 overflow-hidden">
          <ScrollArea className="h-full w-full">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-white">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-2">Cargando logs...</p>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full text-destructive p-4">
                <XCircle className="h-6 w-6 mr-2" />
                <p>{error}</p>
              </div>
            ) : (
              <SyntaxHighlighter
                language="bash"
                style={vscDarkPlus}
                customStyle={{ margin: 0, background: '#1E1E1E', height: '100%' }}
                codeTagProps={{ style: { fontFamily: 'var(--font-geist-mono)' } }}
                showLineNumbers
              >
                {logs}
              </SyntaxHighlighter>
            )}
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button onClick={fetchLogs} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refrescar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}