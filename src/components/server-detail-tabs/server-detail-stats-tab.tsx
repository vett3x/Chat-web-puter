"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, XCircle, BarChart as BarChartIcon, Info } from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatMemory } from '@/lib/utils';

interface ServerDetailStatsTabProps {
  serverId: string;
}

interface StatPoint {
  timestamp: string;
  avg_cpu: number;
  avg_memory_mib: number;
  avg_disk_percent: number;
}

export function ServerDetailStatsTab({ serverId }: ServerDetailStatsTabProps) {
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('24h');
  const [stats, setStats] = useState<StatPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/servers/${serverId}/stats?period=${period}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: StatPoint[] = await response.json();
      setStats(data);
    } catch (err: any) {
      console.error('Error fetching server stats:', err);
      setError(err.message || 'Error al cargar las estadísticas del servidor.');
      toast.error(err.message || 'Error al cargar las estadísticas del servidor.');
    } finally {
      setIsLoading(false);
    }
  }, [serverId, period]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const formatXAxis = (tickItem: string) => {
    if (period === '24h') {
      return format(new Date(tickItem), 'HH:mm');
    }
    return format(new Date(tickItem), 'dd MMM', { locale: es });
  };

  const renderChart = (dataKey: keyof StatPoint, name: string, unit: string, color: string) => (
    <div className="h-[250px] w-full">
      <h5 className="text-md font-semibold mb-2">{name}</h5>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={stats} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
          <XAxis dataKey="timestamp" tickFormatter={formatXAxis} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} unit={unit} />
          <Tooltip
            labelFormatter={(label) => format(new Date(label), 'dd MMM yyyy, HH:mm', { locale: es })}
            formatter={(value: number) => [`${value.toFixed(1)} ${unit}`, name]}
          />
          <Bar dataKey={dataKey} name={name} fill={color} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Cargando estadísticas...</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex items-center justify-center h-full text-destructive">
          <XCircle className="h-6 w-6 mr-2" />
          <p>{error}</p>
        </div>
      );
    }
    if (stats.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center p-4">
          <Info className="h-10 w-10 mb-4" />
          <h3 className="text-lg font-semibold">No hay datos históricos disponibles</h3>
          <p className="max-w-md mt-2">
            Esta función requiere un proceso en segundo plano (cron job) para recolectar datos periódicamente.
            Una vez configurado, los gráficos aparecerán aquí.
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-8 py-4">
        {renderChart('avg_cpu', 'Uso de CPU Promedio', '%', 'hsl(var(--chart-1))')}
        {renderChart('avg_memory_mib', 'Uso de Memoria Promedio', 'MiB', 'hsl(var(--chart-2))')}
        {renderChart('avg_disk_percent', 'Uso de Disco Promedio', '%', 'hsl(var(--chart-3))')}
      </div>
    );
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <BarChartIcon className="h-5 w-5" /> Estadísticas de Uso
          </CardTitle>
          <ToggleGroup
            type="single"
            value={period}
            onValueChange={(value: '24h' | '7d' | '30d') => {
              if (value) setPeriod(value);
            }}
            disabled={isLoading}
          >
            <ToggleGroupItem value="24h">Últimas 24h</ToggleGroupItem>
            <ToggleGroupItem value="7d">Últimos 7d</ToggleGroupItem>
            <ToggleGroupItem value="30d">Últimos 30d</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden pt-0">
        {renderContent()}
      </CardContent>
    </Card>
  );
}