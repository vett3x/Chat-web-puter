"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Loader2, History, CheckCircle2, AlertCircle, GitPullRequest, RefreshCw, Wrench, Bug } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AutoFixStatus } from '@/hooks/use-chat'; // Import AutoFixStatus type
import { cn } from '@/lib/utils'; // Import cn for conditional styling

interface AppVersion {
  created_at: string;
  file_count: number;
}

interface AppVersionsBarProps {
  appId: string;
  onRevertToVersion: (timestamp: string) => void;
  isReverting: boolean;
  autoFixStatus: AutoFixStatus; // NEW: Prop for auto-fix status
  onTriggerFixBuildError: () => void; // NEW: Callback to trigger build error fix
  onTriggerReportWebError: () => void; // NEW: Callback to trigger web error report
}

export function AppVersionsBar({ appId, onRevertToVersion, isReverting, autoFixStatus, onTriggerFixBuildError, onTriggerReportWebError }: AppVersionsBarProps) {
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    setIsLoadingVersions(true);
    setError(null);
    try {
      const response = await fetch(`/api/apps/${appId}/versions`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: AppVersion[] = await response.json();
      setVersions(data);
    } catch (err: any) {
      console.error('Error fetching app versions:', err);
      setError(err.message || 'Error al cargar las versiones de la aplicación.');
      toast.error(err.message || 'Error al cargar las versiones de la aplicación.');
    } finally {
      setIsLoadingVersions(false);
    }
  }, [appId]);

  useEffect(() => {
    if (appId) {
      fetchVersions();
    }
  }, [appId, fetchVersions]);

  const isAutoFixing = autoFixStatus !== 'idle';

  const getAutoFixStatusDisplay = () => {
    switch (autoFixStatus) {
      case 'analyzing': return <span className="flex items-center gap-1 text-yellow-500"><Loader2 className="h-4 w-4 animate-spin" /> Analizando error...</span>;
      case 'plan_ready': return <span className="flex items-center gap-1 text-purple-500"><Wrench className="h-4 w-4" /> Plan listo</span>;
      case 'fixing': return <span className="flex items-center gap-1 text-blue-500"><Loader2 className="h-4 w-4 animate-spin" /> Aplicando corrección...</span>;
      case 'failed': return <span className="flex items-center gap-1 text-destructive"><AlertCircle className="h-4 w-4" /> Arreglo fallido</span>;
      default: return null;
    }
  };

  return (
    <div className="flex items-center justify-between p-2 border-b bg-background">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Versiones:</span>
        {isLoadingVersions ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : error ? (
          <span className="text-destructive text-xs flex items-center gap-1">
            <AlertCircle className="h-4 w-4" /> Error
          </span>
        ) : versions.length === 0 ? (
          <span className="text-muted-foreground text-xs">No hay versiones guardadas.</span>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isReverting || isAutoFixing}>
                <GitPullRequest className="mr-2 h-4 w-4" />
                Seleccionar Versión
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 bg-popover text-popover-foreground border-border">
              <DropdownMenuLabel>Historial de Versiones</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {versions.map((version) => (
                <DropdownMenuItem key={version.created_at} onClick={() => onRevertToVersion(version.created_at)} disabled={isReverting || isAutoFixing}>
                  <div className="flex flex-col">
                    <span className="font-medium">{format(new Date(version.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
                    <span className="text-xs text-muted-foreground">{version.file_count} archivo(s)</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="flex items-center gap-2">
        {getAutoFixStatusDisplay()}
        <Button
          variant="outline"
          size="sm"
          onClick={onTriggerFixBuildError}
          disabled={isAutoFixing}
          title="Corregir el último error de compilación"
        >
          <Wrench className="mr-2 h-4 w-4" /> Corregir Build
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onTriggerReportWebError}
          disabled={isAutoFixing}
          title="Reportar un error en la vista previa web"
        >
          <Bug className="mr-2 h-4 w-4" /> Reportar Web
        </Button>
        <Button variant="ghost" size="icon" onClick={fetchVersions} disabled={isLoadingVersions || isReverting || isAutoFixing} title="Refrescar versiones">
          {isLoadingVersions ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}