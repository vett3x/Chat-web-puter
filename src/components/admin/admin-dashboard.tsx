"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Users, Server, Dock, Globe, ShieldAlert, AlertTriangle, Ticket, Cpu, MemoryStick, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Progress } from '@/components/ui/progress';
import { formatMemory } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface DashboardData {
  systemStatus: {
    security_enabled: boolean;
    maintenance_mode_enabled: boolean;
    users_disabled: boolean;
    admins_disabled: boolean;
  } | null;
  kpis: {
    totalUsers: number;
    activeServers: number;
    runningContainers: number;
    activeTunnels: number;
    criticalAlerts: number;
  };
  criticalAlerts: { id: string; created_at: string; event_type: string; description: string }[] | null;
  errorTickets: { id: string; created_at: string; user_id: string; profiles: { first_name: string | null; last_name: string | null } | null }[] | null;
  resourceUsage: {
    avgCpuPercent: number;
    totalMemoryUsedMiB: number;
  };
}

const KpiCard = ({ title, value, icon, className }: { title: string; value: number; icon: React.ReactNode, className?: string }) => (
  <Card className={cn("bg-black/20 border-white/10", className)}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

interface AdminDashboardTabProps {
  onOpenAlerts: () => void;
}

export function AdminDashboardTab({ onOpenAlerts }: AdminDashboardTabProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/dashboard-stats');
      if (!response.ok) throw new Error((await response.json()).message);
      setData(await response.json());
    } catch (err: any) {
      toast.error(`Error al cargar los datos del panel: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!data) {
    return <div className="text-center text-destructive">No se pudieron cargar los datos del panel de control.</div>;
  }

  const criticalAlerts = data.criticalAlerts || [];
  const errorTickets = data.errorTickets || [];

  return (
    <div className="space-y-6 p-1">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Panel de Control de Super Admin</h2>
        <Button variant="ghost" size="icon" onClick={fetchData} disabled={isLoading}><RefreshCw className="h-5 w-5" /></Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard title="Usuarios Totales" value={data.kpis.totalUsers} icon={<Users className="h-4 w-4 text-muted-foreground" />} />
        <KpiCard title="Servidores Activos" value={data.kpis.activeServers} icon={<Server className="h-4 w-4 text-muted-foreground" />} />
        <KpiCard title="Contenedores Activos" value={data.kpis.runningContainers} icon={<Dock className="h-4 w-4 text-muted-foreground" />} />
        <KpiCard title="Túneles Activos" value={data.kpis.activeTunnels} icon={<Globe className="h-4 w-4 text-muted-foreground" />} />
        <KpiCard title="Alertas Críticas" value={data.kpis.criticalAlerts} icon={<ShieldAlert className="h-4 w-4 text-destructive" />} className="border-destructive/50" />
      </div>

      {/* Alerts & Tickets */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-black/20 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><ShieldAlert className="text-destructive" /> Alertas Críticas Recientes</CardTitle>
            <Button size="sm" onClick={onOpenAlerts} className="bg-green-600 hover:bg-green-700 text-white">Ver Todas</Button>
          </CardHeader>
          <CardContent>
            {criticalAlerts.length === 0 ? <p className="text-sm text-muted-foreground">No hay alertas críticas.</p> : (
              <ul className="space-y-2">{criticalAlerts.map(alert => (<li key={alert.id} className="text-xs"><span className="font-semibold">{alert.event_type}:</span> {alert.description.substring(0, 80)}...</li>))}</ul>
            )}
          </CardContent>
        </Card>
        <Card className="bg-black/20 border-white/10">
          <CardHeader><CardTitle className="flex items-center gap-2"><Ticket className="text-blue-500" /> Nuevos Tickets de Error de IA</CardTitle></CardHeader>
          <CardContent>
            {errorTickets.length === 0 ? <p className="text-sm text-muted-foreground">No hay tickets nuevos.</p> : (
              <ul className="space-y-2">{errorTickets.map(ticket => (<li key={ticket.id} className="text-xs">Usuario: {ticket.profiles?.first_name || 'N/A'} - {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: es })}</li>))}</ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resource Usage */}
      <Card className="bg-black/20 border-white/10">
        <CardHeader><CardTitle>Uso Agregado de Recursos</CardTitle><CardDescription>Uso combinado de todos los servidores activos.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm font-medium mb-1"><span><Cpu className="inline h-4 w-4 mr-1" /> CPU Promedio</span><span>{data.resourceUsage.avgCpuPercent.toFixed(1)}%</span></div>
            <Progress value={data.resourceUsage.avgCpuPercent} />
          </div>
          <div>
            <div className="flex justify-between text-sm font-medium mb-1"><span><MemoryStick className="inline h-4 w-4 mr-1" /> Memoria Total en Uso</span><span>{formatMemory(data.resourceUsage.totalMemoryUsedMiB)}</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}