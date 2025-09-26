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
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ServerEvent {
  id: string;
  event_type: string;
  description: string;
  created_at: string;
  command_details: string | null;
}

const DANGEROUS_KEYWORDS = ['rm -rf', 'mv /', 'dd ', 'mkfs', 'shutdown', 'reboot', ':(){:|:&};:', '> /dev/sda', 'chmod -R 777'];

const isCommandSuspicious = (command: string | null | undefined): boolean => {
  if (!command) return false;
  const normalizedCommand = command.toLowerCase().trim();
  // Check for exact commands or commands with dangerous flags
  return DANGEROUS_KEYWORDS.some(keyword => {
    const lowerKeyword = keyword.toLowerCase();
    // Check if the command starts with the keyword (e.g., "rm -rf /") or is the exact keyword
    return normalizedCommand.startsWith(lowerKeyword + ' ') || normalizedCommand === lowerKeyword;
  });
};

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
  const [expandedHistoryContainerId, setExpandedHistoryContainerId] = useState<string | null>(null);
  const [containerHistory, setContainerHistory] = useState<ServerEvent[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);

  const openCreateTunnelDialogFor = (container: DockerContainer) => {
    setSelectedContainerForTunnel(container);
    setIsTunnelDialogOpen(true);
  };

  const fetchAndDisplayHistory = async (containerId: string) => {
    if (expandedHistoryContainerId === containerId) {
      setExpandedHistoryContainerId(null);
      return;
    }
    setExpandedHistoryContainerId(containerId);
    setIsHistoryLoading(true);
    setContainerHistory([]);
    try {
      const response = await fetch(`/api/servers/${server.id}/docker/containers/${containerId}/history`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const events: ServerEvent[] = await response.json();
      setContainerHistory(events);
    } catch (err: any) {
      toast.error(`Error al cargar el historial: ${err.message}`);
      setContainerHistory([]);
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
                          <History className="h-4 w-4" />
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
                        <div className="p-2 bg-[#1E1E1E] rounded-b-md max-h-[400px] overflow-y-auto">
                          {isHistoryLoading ? (
                            <div className="flex items-center gap-2 p-4 text-white">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Cargando historial...
                            </div>
                          ) : containerHistory.length === 0 ? (
                            <div className="p-4 text-center text-sm text-gray-400">
                              No hay eventos registrados para este contenedor.
                            </div>
                          ) : (
                            containerHistory.map(event => {
                              const isSuspicious = isCommandSuspicious(event.command_details);
                              return (
                                <div key={event.id} className={cn("mb-2 p-2 rounded text-white", isSuspicious ? "bg-red-900/50 border border-red-700" : "bg-gray-700/20")}>
                                  <pre className="whitespace-pre-wrap font-mono text-xs">
                                    {`[${format(new Date(event.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: es })}] [${event.event_type}]\n${event.description}`}
                                    {event.command_details && (
                                      <span className={cn(isSuspicious && "text-red-300 font-bold")}>
                                        {`\n\n[COMANDO EJECUTADO${isSuspicious ? ' - SOSPECHOSO' : ''}]\n${event.command_details}`}
                                      </span>
                                    )}
                                  </pre>
                                </div>
                              )
                            })
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