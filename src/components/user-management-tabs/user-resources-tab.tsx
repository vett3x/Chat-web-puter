"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, HardDrive, RefreshCw, AlertCircle, Server } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { parseMemoryString } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ServerResourceDetail {
  id: string;
  name: string;
  cpu_usage_percent: number;
  memory_used_mib: number;
  memory_total_mib: number;
  disk_usage_percent: number;
}

interface AggregatedUserResources {
  cpu_usage_percent: number;
  memory_used_mib: number;
  memory_total_mib: number;
  disk_usage_percent: number;
  timestamp: string;
  server_details: ServerResourceDetail[];
}

interface UserResourcesTabProps {
  userId: string;
}

const MAX_HISTORY_POINTS = 12; // Keep last 12 points (1 minute of data if polling every 5s)

export function UserResourcesTab({ userId }: UserResourcesTabProps) {
  const [resources, setResources] = useState<AggregatedUserResources | null>(null);
  const [resourceHistory, setResourceHistory] = useState<AggregatedUserResources[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const POLLING_INTERVAL = 5000; // 5 seconds

  const fetchUserResources = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/users/${userId}/resources`, { credentials: 'include' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: AggregatedUserResources = await response.json();
      setResources(data);
      setResourceHistory(prev => {
        const newHistory = [...prev, data];
        return newHistory.slice(-MAX_HISTORY_POINTS);
      });
    } catch (err: any) {
      console.error(`Error fetching resources for user ${userId}:`, err);
      setError(err.message || 'Error al cargar los recursos del usuario.');
      toast.error(err.message || 'Error al cargar los recursos del usuario.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchUserResources();
      const interval = setInterval(fetchUserResources, POLLING_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [userId, fetchUserResources]);

  const formatChartTick = (value: string) => {
    const date = new Date(value);
    return format(date, 'HH:mm:ss', { locale: es });
  };

  const formatMemory = (mib: number) => {
    if (mib < 1024) return `${mib.toFixed(1)} MiB`;
    return `${(mib / 1024).toFixed(1)} GiB`;
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" /> Uso de Recursos Agregado
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={fetchUserResources} disabled={isLoading} title="Refrescar">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden pt-0">
        {isLoading && !resources ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Cargando recursos...</p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-destructive">
            <AlertCircle className="h-6 w-6 mr-2" />
            <p>{error}</p>
          </div>
        ) : !resources || resources.server_details.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>No hay servidores listos para este usuario o no se pudieron obtener los recursos.</p>
          </div>
        ) : (
          <ScrollArea className="h-full w-full p-1">
            <div className="space-y-6 py-4">
              {/* Current Aggregated Usage */}
              <div>
                <h4 className="text-md font-semibold mb-3">Uso Agregado Actual</h4>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm font-medium mb-1">
                      <span>CPU (Promedio)</span>
                      <span>{resources.cpu_usage_percent.toFixed(1)}%</span>
                    </div>
                    <Progress value={resources.cpu_usage_percent} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm font-medium mb-1">
                      <span>Memoria (Total)</span>
                      <span>{formatMemory(resources.memory_used_mib)} / {formatMemory(resources.memory_total_mib)}</span>
                    </div>
                    <Progress
                      value={resources.memory_total_mib === 0 ? 0 : (resources.memory_used_mib / resources.memory_total_mib) * 100}
                      className="h-2"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm font-medium mb-1">
                      <span>Disco (Promedio)</span>
                      <span>{resources.disk_usage_percent.toFixed(1)}%</span>
                    </div>
                    <Progress value={resources.disk_usage_percent} className="h-2" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">Última actualización: {format(new Date(resources.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: es })}</p>
              </div>

              {/* Historical Charts */}
              {resourceHistory.length > 1 && (
                <div>
                  <h4 className="text-md font-semibold mb-3">Historial Reciente (último minuto)</h4>
                  <div className="space-y-6">
                    {/* CPU Chart */}
                    <div className="h-[150px] w-full">
                      <h5 className="text-sm font-medium mb-1">CPU Promedio (%)</h5>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={resourceHistory} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <XAxis dataKey="timestamp" tickFormatter={formatChartTick} tick={{ fontSize: 10 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                          <RechartsTooltip labelFormatter={formatChartTick} formatter={(value: number) => `${value.toFixed(1)}%`} />
                          <Line type="monotone" dataKey="cpu_usage_percent" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Memory Chart */}
                    <div className="h-[150px] w-full">
                      <h5 className="text-sm font-medium mb-1">Memoria Total (%)</h5>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={resourceHistory} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <XAxis dataKey="timestamp" tickFormatter={formatChartTick} tick={{ fontSize: 10 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                          <RechartsTooltip labelFormatter={formatChartTick} formatter={(value: number, name: string, props: any) => {
                            const totalMiB = props.payload.memory_total_mib;
                            const usedMiB = props.payload.memory_used_mib;
                            if (totalMiB === 0) return [`N/A`, 'Uso'];
                            return [`${((usedMiB / totalMiB) * 100).toFixed(1)}% (${formatMemory(usedMiB)} / ${formatMemory(totalMiB)})`, 'Uso'];
                          }} />
                          <Line
                            type="monotone"
                            dataKey={(data: AggregatedUserResources) => data.memory_total_mib === 0 ? 0 : (data.memory_used_mib / data.memory_total_mib) * 100}
                            stroke="hsl(var(--chart-2))"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Disk Chart */}
                    <div className="h-[150px] w-full">
                      <h5 className="text-sm font-medium mb-1">Disco Promedio (%)</h5>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={resourceHistory} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <XAxis dataKey="timestamp" tickFormatter={formatChartTick} tick={{ fontSize: 10 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                          <RechartsTooltip labelFormatter={formatChartTick} formatter={(value: number) => `${value.toFixed(1)}%`} />
                          <Line type="monotone" dataKey="disk_usage_percent" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* Individual Server Details */}
              {resources.server_details.length > 0 && (
                <div>
                  <h4 className="text-md font-semibold mb-3">Detalles por Servidor</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Servidor</TableHead>
                        <TableHead>CPU</TableHead>
                        <TableHead>Memoria</TableHead>
                        <TableHead>Disco</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resources.server_details.map((detail) => (
                        <TableRow key={detail.id}>
                          <TableCell className="font-medium flex items-center gap-1">
                            <Server className="h-4 w-4 text-muted-foreground" /> {detail.name}
                          </TableCell>
                          <TableCell>{detail.cpu_usage_percent.toFixed(1)}%</TableCell>
                          <TableCell>{formatMemory(detail.memory_used_mib)} / {formatMemory(detail.memory_total_mib)}</TableCell>
                          <TableCell>{detail.disk_usage_percent.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}