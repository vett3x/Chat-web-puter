"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2, Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AppPreviewProps {
  appId: string;
  appUrl: string | null;
  isProvisioning: boolean;
  isDeleting: boolean;
  onRefresh: () => void;
}

export function AppPreview({ appId, appUrl, isProvisioning, isDeleting, onRefresh }: AppPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleRefresh = () => {
    if (iframeRef.current) {
      setIsLoading(true);
      iframeRef.current.src = iframeRef.current.src;
    }
    onRefresh();
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const openInNewTab = () => {
    if (appUrl) {
      window.open(appUrl, '_blank');
    }
  };

  // Function to write files to the app
  const writeFiles = useCallback(async (files: { path: string; content: string }[]) => {
    console.log('[AppPreview] writeFiles called with files:', files);
    
    if (!appId) {
      console.error('[AppPreview] No appId provided');
      toast.error('No se puede escribir archivos: ID de aplicación no encontrado');
      return;
    }

    if (!files || files.length === 0) {
      console.warn('[AppPreview] No files to write');
      return;
    }

    try {
      console.log(`[AppPreview] Sending ${files.length} files to API endpoint /api/apps/${appId}/files`);
      
      const response = await fetch(`/api/apps/${appId}/files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files }),
      });

      console.log('[AppPreview] API response status:', response.status);
      
      const data = await response.json();
      console.log('[AppPreview] API response data:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Error al escribir archivos');
      }

      toast.success(`${files.length} archivo(s) guardado(s) correctamente`);
      
      // Refresh the iframe after writing files
      setTimeout(() => {
        console.log('[AppPreview] Refreshing iframe after file write');
        handleRefresh();
      }, 1000);
    } catch (error) {
      console.error('[AppPreview] Error writing files:', error);
      toast.error(`Error al escribir archivos: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }, [appId]);

  // Expose writeFiles function to parent components
  useEffect(() => {
    if (window) {
      (window as any).appPreviewWriteFiles = writeFiles;
    }
    return () => {
      if (window) {
        delete (window as any).appPreviewWriteFiles;
      }
    };
  }, [writeFiles]);

  if (isProvisioning) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/10 rounded-lg">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Aprovisionando aplicación...</p>
        </div>
      </div>
    );
  }

  if (isDeleting) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/10 rounded-lg">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-destructive" />
          <p className="text-muted-foreground">Eliminando aplicación...</p>
        </div>
      </div>
    );
  }

  if (!appUrl) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/10 rounded-lg">
        <p className="text-muted-foreground">La URL de la aplicación no está disponible</p>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col h-full transition-all duration-300",
      isFullscreen && "fixed inset-0 z-50 bg-background"
    )}>
      <div className="flex items-center justify-between p-2 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground truncate max-w-[300px]">
            {appUrl}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
            className="h-8 w-8"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={openInNewTab}
            className="h-8 w-8"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="h-8 w-8"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      <div className="flex-1 relative bg-white">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={appUrl}
          className="w-full h-full border-0"
          onLoad={handleIframeLoad}
          title="App Preview"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
        />
      </div>
    </div>
  );
}