"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Wand2, Loader2, ArrowLeft, ArrowRight, RefreshCw, ExternalLink, Terminal, ChevronDown, ChevronRight, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { toast } from 'sonner';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface AppBrowserPanelProps {
  appId: string | null;
  appUrl: string | null;
  appStatus: string | null;
  isAppDeleting?: boolean;
}

function SystemLogsPanel({ appId }: { appId: string }) {
  const [logs, setLogs] = useState('');
  const [isLoading, setIsLoading] = useState(true); // Start in loading state

  const fetchLogs = useCallback(async () => {
    if (!appId) return;
    // No setIsLoading(true) here to make refreshes subtle
    try {
      const response = await fetch(`/api/apps/${appId}/logs`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setLogs(data.logs);
    } catch (error: any) {
      setLogs(`Error al cargar los logs: ${error.message}`);
    } finally {
      setIsLoading(false); // Set to false after the first load
    }
  }, [appId]);

  useEffect(() => {
    fetchLogs(); // Initial fetch
    const interval = setInterval(fetchLogs, 10000); // Refresh logs every 10 seconds
    return () => clearInterval(interval);
  }, [fetchLogs]);

  return (
    <Collapsible className="flex flex-col h-full">
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-2 border-t bg-muted cursor-pointer">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            <h3 className="text-sm font-semibold">Mensajes del Sistema</h3>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto bg-[#1E1E1E]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-white"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <SyntaxHighlighter language="bash" style={vscDarkPlus} customStyle={{ margin: 0, height: '100%', overflow: 'auto' }} codeTagProps={{ style: { fontFamily: 'var(--font-geist-mono)' } }}>
              {logs}
            </SyntaxHighlighter>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AppBrowserPanel({ appId, appUrl, appStatus, isAppDeleting = false }: AppBrowserPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isRestarting, setIsRestarting] = useState(false);

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const handleRestart = async () => {
    if (!appId) return;
    setIsRestarting(true);
    try {
      const response = await fetch(`/api/apps/${appId}/restart`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      setTimeout(handleRefresh, 3000); // Refresh after a delay
    } catch (error: any) {
      toast.error(`Error al reiniciar: ${error.message}`);
    } finally {
      setIsRestarting(false);
    }
  };

  const renderContent = () => {
    if (isAppDeleting) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
          <Loader2 className="h-12 w-12 animate-spin text-destructive mb-4" />
          <h3 className="text-lg font-semibold">Eliminando Proyecto</h3>
          <p>Por favor, espera mientras se eliminan todos los recursos asociados...</p>
        </div>
      );
    }

    if (appStatus === 'provisioning') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <h3 className="text-lg font-semibold">Aprovisionando Entorno</h3>
          <p>Creando contenedor, configurando dominio y desplegando la base de Next.js...</p>
          <p className="text-sm mt-2">(Esto puede tardar unos minutos)</p>
        </div>
      );
    }

    if (appUrl && appStatus === 'ready') {
      return (
        <iframe
          ref={iframeRef}
          src={appUrl}
          title="App Preview"
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
        <Wand2 className="h-12 w-12 mb-4" />
        <h3 className="text-lg font-semibold">Vista Previa de la Aplicación</h3>
        <p>Selecciona una aplicación o crea una nueva para ver la vista previa en vivo aquí.</p>
      </div>
    );
  };

  return (
    <div className="h-full w-full bg-muted/30 flex flex-col">
      <div className="flex items-center p-2 border-b bg-background gap-2">
        <Button variant="ghost" size="icon" disabled><ArrowLeft className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" disabled><ArrowRight className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={handleRefresh}><RefreshCw className="h-4 w-4" /></Button>
        <div className="flex-1 bg-muted rounded-md px-3 py-1.5 text-sm text-muted-foreground truncate">
          {appUrl || 'about:blank'}
        </div>
        <Button variant="outline" size="sm" onClick={handleRestart} disabled={!appId || isRestarting}>
          {isRestarting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Power className="h-4 w-4 mr-2" />}
          Reiniciar
        </Button>
        <a href={appUrl || '#'} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="icon" disabled={!appUrl}><ExternalLink className="h-4 w-4" /></Button>
        </a>
      </div>
      <ResizablePanelGroup direction="vertical" className="flex-1">
        <ResizablePanel defaultSize={80}>
          {renderContent()}
        </ResizablePanel>
        {appId && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={20} minSize={10} maxSize={50}>
              <SystemLogsPanel appId={appId} />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}