"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, RefreshCw, XCircle, Dock, Server, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { DockerContainerStat } from '@/types/docker-stats';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';

const POLLING_INTERVAL = 5000; // Poll every 5 seconds

export function AllDockerContainersTab() {
  const [containerStats, setContainerStats] = useState<DockerContainerStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllDockerStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/docker-stats');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: DockerContainerStat[] = await response.json();
      setContainerStats(data);
    } catch (err: any) {
      console.error('Error fetching all Docker stats:', err);
      setError(err.message || 'Error al cargar las estadísticas de Docker.');
      toast.error(err.message || 'Error al cargar las estadísticas de Docker.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllDockerStats();
    const interval = setInterval(fetchAllDockerStats, POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAllDockerStats]);

  const runningContainers = containerStats.filter(c => parseFloat(c['CPU %']) > 0 || parseFloat(c['Mem %']) > 0);
  const stoppedContainers = containerStats.filter(c => parseFloat(c['CPU %']) === 0 && parseFloat(c['Mem %']) === 0);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <Dock className="h-5 w-5" /> Resumen de Contenedores Docker
        </CardTitle>
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-sm font-medium text-destructive flex items-center gap-1" title="Error al cargar datos">
              <AlertCircle className="h-4 w-4" /> Error
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={fetchAllDockerStats} disabled={isLoading} title="Refrescar">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden pt-0">
        {isLoading && containerStats.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Cargando estadísticas de contenedores...</p>
          </div>
        ) : error && containerStats.length === 0 ? (
          <div className="flex items-center justify-center h-full text-destructive">
            <XCircle className="h-6 w-6 mr-2" />
            <p>{error}</p>
          </div>
        ) : containerStats.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>No se encontraron contenedores Docker activos en tus servidores listos.</p>
          </div>
        ) : (
          <ScrollArea className="h-full w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Servidor</TableHead>
                  <TableHead>ID Contenedor</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Imagen</TableHead>
                  <TableHead>CPU</TableHead>
                  <TableHead>Memoria</TableHead>
                  <TableHead>Red I/O</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {containerStats.map((stat) => (
                  <TableRow key={`${stat.serverId}-${stat.ID}`} className={cn(
                    (parseFloat(stat['CPU %']) === 0 && parseFloat(stat['Mem %']) === 0) && "text-muted-foreground opacity-70"
                  )}>
                    <TableCell className="flex items-center gap-1">
                      <Server className="h-4 w-4 text-muted-foreground" />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="truncate max-w-[100px]">{stat.serverName}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{stat.serverName} ({stat.serverIpAddress})</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{stat.ID.substring(0, 12)}</TableCell>
                    <TableCell>{stat.Name}</TableCell>
                    <TableCell>{stat.Image}</TableCell>
                    <TableCell>{stat['CPU %']}</TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>{stat['Mem Usage'].split('/')[0].trim()}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Uso: {stat['Mem Usage']}</p>
                            <p>Porcentaje: {stat['Mem %']}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>{stat['Net I/O']}</TableCell>
                    <TableCell>
                      {parseFloat(stat['CPU %']) > 0 || parseFloat(stat['Mem %']) > 0 ? (
                        <span className="text-green-500">Activo</span>
                      ) : (
                        <span className="text-red-500">Inactivo</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}