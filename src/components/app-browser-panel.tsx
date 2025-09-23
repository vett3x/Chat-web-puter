"use client";

import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Wand2, Loader2, ArrowLeft, ArrowRight, RefreshCw, ExternalLink, Terminal, Power, Server, Cloud, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { toast } from 'sonner';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AppBrowserPanelProps {
  appId: string | null;
  appUrl: string | null;
  appStatus: string | null;
  isAppDeleting?: boolean;
}

interface ServerEvent {
  id: string;
  event_type: string;
  description: string;
  created_at: string;
}

function SystemActivityPanel({ appId }: { appId: string }) {
  const [events, setEvents] = useState<ServerEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    if (!appId) return;
    try {
      const response = await fetch(`/api/apps/${appId}/activity`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setEvents(data);
    } catch (error: any) {
      setEvents([{ id: 'error', event_type: 'error', description: `Error al cargar la actividad: ${error.message}`, created_at: new Date().toISOString() }]);
    } finally {
      setIsLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, 10000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  return (
    <div className="h-full overflow-auto bg-[#1E1E1E] p-4 text-white font-mono text-xs">
      {isLoading ? (
        <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Cargando actividad...</div>
      ) : (
        events.map(event => (
          <div key={event.id} className="flex gap-4">
            <span className="text-gray-500">{format(new Date(event.created_at), 'HH:mm:ss', { locale: es })}</span>
            <span className="flex-1">{event.description}</span>
          </div>
        ))
      )}
    </div>
  );
}

function SystemLogsPanel({ appId }: { appId: string }) {
  const [logs, setLogs] = useState({ nextjs: '', cloudflared: '' });
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!appId) return;
    try {
      const response = await fetch(`/api/apps/${appId}/logs`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setLogs({ nextjs: data.nextjsLogs, cloudflared: data.cloudflaredLogs });
    } catch (error: any) {
      setLogs({ 
        nextjs: `Error al cargar los logs de Next.js: ${error.message}`,
        cloudflared: `Error al cargar los logs del túnel: ${error.message}`
      });
    } finally {
      setIsLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const renderLogContent = (logContent: string) => (
    <div className="h-full overflow-auto bg-[#1E1E1E]">
      {isLoading ? (
        <div className="flex items-center justify-center h-full text-white"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <SyntaxHighlighter language="bash" style={vscDarkPlus} customStyle={{ margin: 0, height: '100%', overflow: 'auto' }} codeTagProps={{ style: { fontFamily: 'var(--font-geist-mono)' } }}>
          {logContent}
        </SyntaxHighlighter>
      )}
    </div>
  );

  return (
    <Tabs defaultValue="nextjs" className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-t bg-muted">
        <TabsList className="grid grid-cols-3 w-[450px]">
          <TabsTrigger value="activity" className="flex items-center gap-2"><History className="h-4 w-4" /> Actividad del Sistema</TabsTrigger>
          <TabsTrigger value="nextjs" className="flex items-center gap-2"><Server className="h-4 w-4" /> Logs de Next.js</TabsTrigger>
          <TabsTrigger value="cloudflared" className="flex items-center gap-2"><Cloud className="h-4 w-4" /> Logs del Túnel</TabsTrigger>
        </TabsList>
        <Button variant="ghost" size="icon" onClick={fetchLogs} disabled={isLoading} className="h-7 w-7">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>
      <TabsContent value="activity" className="flex-1 overflow-hidden">
        <SystemActivityPanel appId={appId} />
      </TabsContent>
      <TabsContent value="nextjs" className="flex-1 overflow-hidden">
        {renderLogContent(logs.nextjs)}
      </TabsContent>
      <TabsContent value="cloudflared" className="flex-1 overflow-hidden">
        {renderLogContent(logs.cloudflared)}
      </TabsContent>
    </Tabs>
  );
}

export const AppBrowserPanel = forwardRef<
  { refresh: () => void },
  AppBrowserPanelProps
>(({ appId, appUrl, appStatus, isAppDeleting = false }, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isRestarting, setIsRestarting] = useState(false);

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  useImperativeHandle(ref, () => ({
    refresh: handleRefresh,
  }));

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
});

AppBrowserPanel.displayName = 'AppBrowserPanel';