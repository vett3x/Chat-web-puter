"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Trash2, AlertCircle, Play, StopCircle, Terminal, Globe, History, ScrollText, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DockerContainer } from '@/types/docker';
import { CreateTunnelDialog } from './CreateTunnelDialog';
import { ContainerHistoryDialog } from '@/components/container-history-dialog';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ServerEvent {
  id: string;
  event_type: string;
  description: string;
  created_at: string;
}

interface DockerContainerListProps {
  containers: DockerContainer[];
  server: { id: string };
  isLoading: boolean;
  actionLoading: string | null;
  onAction: (containerId: string, action: 'start' | 'stop' | 'delete' | 'restart') => void;
  onRefresh: () => void;
  canManageDockerContainers: boolean;
  canManageCloudflareTunnels: boolean;
}

export function DockerContainerList({ containers, server, isLoading, actionLoading, onAction, onRefresh, canManageDockerContainers, canManageCloudflareTunnels }: DockerContainerListProps) {
  const [isTunnelDialogOpen, setIsTunnelDialogOpen] = useState(false);
  const [selectedContainerForTunnel, setSelectedContainerForTunnel] = useState<DockerContainer | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedContainerForHistory, setSelectedContainerForHistory] = useState<DockerContainer | null>(null);
  const [expandedHistoryContainerId, setExpandedHistoryContainerId] = useState<string | null>(null);
  const [containerHistoryLog, setContainerHistoryLog] = useState<string>('');
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);

  const openCreateTunnelDialogFor = (container: DockerContainer) => {
    setSelectedContainerForTunnel(container);
    setIsTunnelDialogOpen(true);
  };

  const openHistoryFor = (container: DockerContainer) => {
    setSelectedContainerForHistory(container);
    setIsHistoryOpen(true);
  };

  const fetchAndDisplayHistory = async (containerId: string) => {
    if (expandedHistoryContainerId === containerId) {
      setExpandedHistoryContainerId(null); // Collapse if already open
      return;
    }
    setExpandedHistoryContainerId(containerId);
    setIsHistoryLoading(true);
    setContainerHistoryLog('Cargando historial...');
    try {
      const response = await fetch(`/api/servers/${server.id}/docker/containers/${containerId}/history`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const events: ServerEvent[] = await response.json();
      if (events.length === 0) {
        setContainerHistoryLog('No hay eventos registrados para este contenedor.');
      } else {
        const formattedLog = events
          .map(event => 
            `[${format(new Date(event.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: es })}] [${event.event_type}]\n${event.description}\n--------------------------------------------------`
          )
          .join('\n\n');
        setContainerHistoryLog(formattedLog);
      }
    } catch (err: any) {
      toast.error(`Error al cargar el historial: ${err.message}`);
      setContainerHistoryLog(`Error al cargar el historial: ${err.message}`);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  return (
    <>
      <TooltipProvider>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Imagen</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Puertos</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {containers.map((container) => {
              const isRunning = container.Status.includes('Up');
              const isGracefullyExited = container.Status.includes('Exited (0)') || container.Status.includes('Exited (137)');
              const isErrorState = !isRunning && !isGracefullyExited;
              const isWarningState = !isRunning && isGracefullyExited;
              const isActionInProgress = actionLoading === container.ID;
              const isHistoryExpanded = expandedHistoryContainerId === container.ID;

              return (
                <React.Fragment key={container.ID}>
                  <TableRow 
                    className={cn(
                      isErrorState && "bg-destructive/10 text-destructive hover:bg-destructive/20",
                      isWarningState && "bg-warning/10 text-warning hover:bg-warning/20",
                      isHistoryExpanded && "border-b-0"
                    )}
                  >
                    <TableCell className="font-mono text-xs">{container.ID.substring(0, 12)}</TableCell>
                    <TableCell>{container.Names}</TableCell>
                    <TableCell>{container.Image}</TableCell>
                    <TableCell className="align-middle">
                      <div className="flex items-center gap-1">
                        {(isErrorState || isWarningState) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                {isErrorState ? (
                                  <AlertCircle className="h-4 w-4" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-warning" />
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{isErrorState ? 'Contenedor con problemas' : 'Contenedor detenido'}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <span>{container.Status}</span>
                      </div>
                    </TableCell>
                    <TableCell>{container.Ports || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="icon" onClick={() => fetchAndDisplayHistory(container.ID)} title="Ver historial" disabled={!canManageDockerContainers}>
                          <Terminal className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={isActionInProgress || !canManageDockerContainers}>{isActionInProgress ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Acciones</Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onAction(container.ID, 'start')} disabled={isRunning || isActionInProgress}>
                              <Play className="mr-2 h-4 w-4" /> Iniciar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onAction(container.ID, 'stop')} disabled={!isRunning || isActionInProgress}>
                              <StopCircle className="mr-2 h-4 w-4" /> Detener
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onAction(container.ID, 'restart')} disabled={isActionInProgress}>
                              <RefreshCw className="mr-2 h-4 w-4" /> Reiniciar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openHistoryFor(container)} disabled={isActionInProgress}>
                              <ScrollText className="mr-2 h-4 w-4" /> Ver Historial (Legacy)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openCreateTunnelDialogFor(container)} disabled={isActionInProgress || !canManageCloudflareTunnels}>
                              <Globe className="mr-2 h-4 w-4" /> Crear Túnel Cloudflare
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={isActionInProgress} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Eliminar</DropdownMenuItem></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>¿Estás seguro de eliminar este contenedor?</AlertDialogTitle><AlertDialogDescription>Esta acción eliminará permanentemente el contenedor "{container.Names}" ({container.ID.substring(0, 12)}).</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => onAction(container.ID, 'delete')} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                  {isHistoryExpanded && (
                    <TableRow>
                      <TableCell colSpan={6} className="p-0">
                        <div className="p-2 bg-[#1E1E1E] rounded-b-md">
                          {isHistoryLoading ? (
                            <div className="flex items-center gap-2 p-4 text-white">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Cargando historial...
                            </div>
                          ) : (
                            <SyntaxHighlighter
                              language="bash"
                              style={vscDarkPlus}
                              customStyle={{ margin: 0, padding: '1rem', fontSize: '0.875rem', lineHeight: '1.25rem', maxHeight: '400px', overflowY: 'auto' }}
                              codeTagProps={{ style: { fontFamily: 'var(--font-geist-mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' } }}
                            >
                              {containerHistoryLog}
                            </SyntaxHighlighter>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TooltipProvider>
      {selectedContainerForHistory && (
        <ContainerHistoryDialog
          open={isHistoryOpen}
          onOpenChange={setIsHistoryOpen}
          server={server}
          container={selectedContainerForHistory}
        />
      )}
      <CreateTunnelDialog
        open={isTunnelDialogOpen}
        onOpenChange={setIsTunnelDialogOpen}
        server={server}
        container={selectedContainerForTunnel}
        onTunnelCreated={onRefresh}
        canManageCloudflareTunnels={canManageCloudflareTunnels}
      />
    </>
  );
}