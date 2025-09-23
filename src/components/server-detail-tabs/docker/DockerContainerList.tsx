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
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Trash2, AlertCircle, Play, StopCircle, Terminal, Globe, History, ScrollText } from 'lucide-react'; // Import ScrollText
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DockerContainer } from '@/types/docker';
import { CreateTunnelDialog } from './CreateTunnelDialog';
import { ContainerLogsDialog } from '@/components/container-logs-dialog';
import { ContainerHistoryDialog } from '@/components/container-history-dialog'; // Import new dialog

interface DockerContainerListProps {
  containers: DockerContainer[];
  server: { id: string };
  isLoading: boolean;
  actionLoading: string | null;
  onAction: (containerId: string, action: 'start' | 'stop' | 'delete') => void;
  onRefresh: () => void;
  canManageDockerContainers: boolean;
  canManageCloudflareTunnels: boolean;
}

export function DockerContainerList({ containers, server, isLoading, actionLoading, onAction, onRefresh, canManageDockerContainers, canManageCloudflareTunnels }: DockerContainerListProps) {
  const [isTunnelDialogOpen, setIsTunnelDialogOpen] = useState(false);
  const [selectedContainerForTunnel, setSelectedContainerForTunnel] = useState<DockerContainer | null>(null);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [selectedContainerForLogs, setSelectedContainerForLogs] = useState<DockerContainer | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false); // State for history dialog
  const [selectedContainerForHistory, setSelectedContainerForHistory] = useState<DockerContainer | null>(null); // State for history dialog

  const openCreateTunnelDialogFor = (container: DockerContainer) => {
    setSelectedContainerForTunnel(container);
    setIsTunnelDialogOpen(true);
  };

  const openLogsFor = (container: DockerContainer) => {
    setSelectedContainerForLogs(container);
    setIsLogsOpen(true);
  };

  const openHistoryFor = (container: DockerContainer) => { // Handler for history dialog
    setSelectedContainerForHistory(container);
    setIsHistoryOpen(true);
  };

  return (
    <>
      <ScrollArea className="h-full w-full">
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

                return (
                  <TableRow 
                    key={container.ID} 
                    className={cn(
                      isErrorState && "bg-destructive/10 text-destructive hover:bg-destructive/20",
                      isWarningState && "bg-warning/10 text-warning hover:bg-warning/20"
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
                        <Button variant="outline" size="icon" onClick={() => openLogsFor(container)} title="Ver logs" disabled={!canManageDockerContainers}>
                          <Terminal className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={isActionInProgress || !canManageDockerContainers}>{isActionInProgress ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Acciones</Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openLogsFor(container)} disabled={isActionInProgress || !canManageDockerContainers}>
                              <History className="mr-2 h-4 w-4" /> Ver Logs
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openHistoryFor(container)} disabled={isActionInProgress || !canManageDockerContainers}>
                              <ScrollText className="mr-2 h-4 w-4" /> Ver Historial
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openCreateTunnelDialogFor(container)} disabled={isActionInProgress || !canManageCloudflareTunnels}>
                              <Globe className="mr-2 h-4 w-4" /> Crear Túnel Cloudflare
                            </DropdownMenuItem>
                            <AlertDialog>
                              <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={isActionInProgress || !canManageDockerContainers} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Eliminar</DropdownMenuItem></AlertDialogTrigger>
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
                );
              })}
            </TableBody>
          </Table>
        </TooltipProvider>
      </ScrollArea>
      {selectedContainerForLogs && (
        <ContainerLogsDialog
          open={isLogsOpen}
          onOpenChange={setIsLogsOpen}
          server={server}
          container={selectedContainerForLogs}
        />
      )}
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