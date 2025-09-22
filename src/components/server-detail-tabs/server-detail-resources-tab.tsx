"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HardDrive, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { parseMemoryString, formatMemory } from '@/lib/utils';
import { useSession } from '@/components/session-context-provider'; // Import useSession
import { PERMISSION_KEYS } from '@/lib/constants'; // Import PERMISSION_KEYS
import { ServerResources } from '@/types/server-resources';

interface ServerDetailResourcesTabProps {
  serverId: string;
}

const POLLING_INTERVAL = 5000; // Poll every 5 seconds
const MAX_HISTORY_POINTS = 12; // Keep last 12 points (1 minute of data)

export function ServerDetailResourcesTab({ serverId }: ServerDetailResourcesTabProps) {
  const [resources, setResources] = useState<ServerResources | null>(null);
  const [resourceHistory, setResourceHistory] = useState<ServerResources[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResources = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/servers/${serverId}/resources`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: ServerResources = await response.json();
      setResources(data);
      setResourceHistory(prev => {
        const newHistory = [...prev, data];
        return newHistory.slice(-MAX_HISTORY_POINTS); // Keep only the last N points
      });
    } catch (err: any) {
      console.error('Error fetching server resources:', err);
      setError(err.message || 'Error al cargar los recursos del servidor.');
      toast.error(err.message || 'Error al cargar los recursos del servidor.');
    } finally {
      setIsLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    if (serverId) {
      fetchResources();
      const interval = setInterval(fetchResources, POLLING_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [serverId, fetchResources]);

  const formatChartTick = (value: string) => {
    const date = new Date(value);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" /> Uso de Recursos</CardTitle>
        <Button variant="ghost" size="icon" onClick={fetchResources} disabled={isLoading} title="Refrescar">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden pt-0">
        {isLoading && !resources ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Cargando recursos...</p></div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-destructive"><XCircle className="h-6 w-6 mr-2" /><p>{error}</p></div>
        ) : resources ? (
          <ScrollArea className="h-full w-full p-1">
            <div className="space-y-6 py-4">
              {/* Current Usage */}
              <div>
                <h4 className="text-md font-semibold mb-3">Uso Actual</h4>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm font-medium mb-1">
                      <span>CPU</span>
                      <span>{resources.cpu_usage_percent.toFixed(1)}%</span>
                    </div>
                    <Progress value={resources.cpu_usage_percent} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm font-medium mb-1">
                      <span>Memoria</span>
                      <span>{formatMemory(resources.memory_used_mib)} / {formatMemory(resources.memory_total_mib)}</span>
                    </div>
                    <Progress 
                      value={resources.memory_total_mib === 0 ? 0 : (resources.memory_used_mib / resources.memory_total_mib) * 100} 
                      className="h-2" 
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm font-medium mb-1">
                      <span>Disco (Root)</span>
                      <span>{resources.disk_usage_percent.toFixed(1)}%</span>
                    </div>
                    <Progress value={resources.disk_usage_percent} className="h-2" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">Última actualización: {new Date(resources.timestamp).toLocaleTimeString()}</p>
              </div>

              {/* Historical Charts */}
              {resourceHistory.length > 1 && (
                <div>
                  <h4 className="text-md font-semibold mb-3">Historial Reciente (último minuto)</h4>
                  <div className="space-y-6">
                    {/* CPU Chart */}
                    <div className="h-[150px] w-full">
                      <h5 className="text-sm font-medium mb-1">CPU (%)</h5>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={resourceHistory} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <XAxis dataKey="timestamp" tickFormatter={formatChartTick} tick={{ fontSize: 10 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                          <RechartsTooltip labelFormatter={formatChartTick} formatter={(value: number) => `${value.toFixed(1)}%`} />
                          <Line 
                            type="monotone" 
                            dataKey="cpu_usage_percent" 
                            stroke="hsl(var(--chart-1))" 
                            strokeWidth={2} 
                            dot={false} 
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Memory Chart */}
                    <div className="h-[150px] w-full">
                      <h5 className="text-sm font-medium mb-1">Memoria (%)</h5>
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
                            dataKey={(data: ServerResources) => data.memory_total_mib === 0 ? 0 : (data.memory_used_mib / data.memory_total_mib) * 100} 
                            stroke="hsl(var(--chart-2))" 
                            strokeWidth={2} 
                            dot={false} 
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Disk Chart */}
                    <div className="h-[150px] w-full">
                      <h5 className="text-sm font-medium mb-1">Disco (%)</h5>
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
            </div>
          </ScrollArea>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground"><p>No hay datos de recursos disponibles.</p></div>
        )}
      </CardContent>
    </Card>
  );
}