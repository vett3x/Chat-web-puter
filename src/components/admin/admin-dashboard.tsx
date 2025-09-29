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

interface DashboardData {
  systemStatus: {
    security_enabled: boolean;
    maintenance_mode_enabled: boolean;
    users_disabled: boolean;
    admins_disabled: boolean;
  } | null; // Allow systemStatus to be null
  kpis: {
    totalUsers: number;
    activeServers: number;
    runningContainers: number;
    activeTunnels: number;
  };
  criticalAlerts: { id: string; created_at: string; event_type: string; description: string }[];
  errorTickets: { id: string; created_at: string; user_id: string; profiles: { first_name: string | null; last_name: string | null } | null }[];
  resourceUsage: {
    avgCpuPercent: number;
    totalMemoryUsedMiB: number;
  };
}

const KpiCard = ({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

export function AdminDashboardTab() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState<string | null>(null);

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

  const handleToggleSetting = async (setting: keyof NonNullable<DashboardData['systemStatus']>, checked: boolean) => {
    setIsToggling(setting);
    try {
      const response = await fetch('/api/settings/security', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [setting]: checked }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success('Configuración actualizada.');
      fetchData(); // Refresh all data
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsToggling(null);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!data) {
    return <div className="text-center text-destructive">No se pudieron cargar los datos del panel de control.</div>;
  }

  // Provide default values for systemStatus to prevent crash if it's null
  const systemStatus = data.systemStatus || {
    security_enabled: true,
    maintenance_mode_enabled: false,
    users_disabled: false,
    admins_disabled: false,
  };

  return (
    <div className="space-y-6 p-1">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Panel de Control de Super Admin</h2>
        <Button variant="ghost" size="icon" onClick={fetchData} disabled={isLoading}><RefreshCw className="h-5 w-5" /></Button>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader><CardTitle>Estado del Sistema y Controles Rápidos</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border p-3"><Label htmlFor="security-toggle">Seguridad de Comandos</Label><Switch id="security-toggle" checked={systemStatus.security_enabled} onCheckedChange={(c) => handleToggleSetting('security_enabled', c)} disabled={isToggling === 'security_enabled'} /></div>
          <div className="flex items-center justify-between rounded-lg border p-3"><Label htmlFor="maintenance-toggle">Modo Mantenimiento</Label><Switch id="maintenance-toggle" checked={systemStatus.maintenance_mode_enabled} onCheckedChange={(c) => handleToggleSetting('maintenance_mode_enabled', c)} disabled={isToggling === 'maintenance_mode_enabled'} /></div>
          <div className="flex items-center justify-between rounded-lg border p-3"><Label htmlFor="users-disabled-toggle">Desactivar Usuarios</Label><Switch id="users-disabled-toggle" checked={systemStatus.users_disabled} onCheckedChange={(c) => handleToggleSetting('users_disabled', c)} disabled={isToggling === 'users_disabled'} /></div>
          <div className="flex items-center justify-between rounded-lg border p-3"><Label htmlFor="admins-disabled-toggle">Desactivar Admins</Label><Switch id="admins-disabled-toggle" checked={systemStatus.admins_disabled} onCheckedChange={(c) => handleToggleSetting('admins_disabled', c)} disabled={isToggling === 'admins_disabled'} /></div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Usuarios Totales" value={data.kpis.totalUsers} icon={<Users className="h-4 w-4 text-muted-foreground" />} />
        <KpiCard title="Servidores Activos" value={data.kpis.activeServers} icon={<Server className="h-4 w-4 text-muted-foreground" />} />
        <KpiCard title="Contenedores Activos" value={data.kpis.runningContainers} icon={<Dock className="h-4 w-4 text-muted-foreground" />} />
        <KpiCard title="Túneles Activos" value={data.kpis.activeTunnels} icon={<Globe className="h-4 w-4 text-muted-foreground" />} />
      </div>

      {/* Alerts & Tickets */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="text-destructive" /> Alertas Críticas Recientes</CardTitle></CardHeader>
          <CardContent>
            {data.criticalAlerts.length === 0 ? <p className="text-sm text-muted-foreground">No hay alertas críticas.</p> : (
              <ul className="space-y-2">{data.criticalAlerts.map(alert => (<li key={alert.id} className="text-xs"><span className="font-semibold">{alert.event_type}:</span> {alert.description.substring(0, 80)}...</li>))}</ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Ticket className="text-blue-500" /> Nuevos Tickets de Error de IA</CardTitle></CardHeader>
          <CardContent>
            {data.errorTickets.length === 0 ? <p className="text-sm text-muted-foreground">No hay tickets nuevos.</p> : (
              <ul className="space-y-2">{data.errorTickets.map(ticket => (<li key={ticket.id} className="text-xs">Usuario: {ticket.profiles?.first_name || 'N/A'} - {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: es })}</li>))}</ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resource Usage */}
      <Card>
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