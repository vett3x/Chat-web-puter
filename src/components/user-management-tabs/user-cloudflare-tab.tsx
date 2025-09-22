"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Cloud, RefreshCw, AlertCircle, CheckCircle2, XCircle, Globe, Server } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CloudflareDomain {
  id: string;
  domain_name: string;
  zone_id: string;
  account_id: string;
  created_at: string;
}

interface DockerTunnel {
  id: string;
  container_id: string;
  full_domain: string;
  container_port: number;
  status: 'pending' | 'provisioning' | 'active' | 'failed';
  created_at: string;
  domain_name: string;
  server_name: string;
}

interface UserCloudflareTabProps {
  userId: string;
}

export function UserCloudflareTab({ userId }: UserCloudflareTabProps) {
  const [domains, setDomains] = useState<CloudflareDomain[]>([]);
  const [tunnels, setTunnels] = useState<DockerTunnel[]>([]);
  const [isLoadingDomains, setIsLoadingDomains] = useState(true);
  const [isLoadingTunnels, setIsLoadingTunnels] = useState(true);
  const [errorDomains, setErrorDomains] = useState<string | null>(null);
  const [errorTunnels, setErrorTunnels] = useState<string | null>(null);

  const fetchCloudflareData = useCallback(async () => {
    setIsLoadingDomains(true);
    setIsLoadingTunnels(true);
    setErrorDomains(null);
    setErrorTunnels(null);

    try {
      const domainsResponse = await fetch(`/api/users/${userId}/cloudflare-domains`, { credentials: 'include' });
      if (!domainsResponse.ok) {
        const errorData = await domainsResponse.json();
        throw new Error(errorData.message || `HTTP error! status: ${domainsResponse.status}`);
      }
      const domainsData: CloudflareDomain[] = await domainsResponse.json();
      setDomains(domainsData);
    } catch (err: any) {
      console.error(`Error fetching Cloudflare domains for user ${userId}:`, err);
      setErrorDomains(err.message || 'Error al cargar los dominios de Cloudflare.');
      toast.error(err.message || 'Error al cargar los dominios de Cloudflare.');
    } finally {
      setIsLoadingDomains(false);
    }

    try {
      const tunnelsResponse = await fetch(`/api/users/${userId}/docker-tunnels`, { credentials: 'include' });
      if (!tunnelsResponse.ok) {
        const errorData = await tunnelsResponse.json();
        throw new Error(errorData.message || `HTTP error! status: ${tunnelsResponse.status}`);
      }
      const tunnelsData: DockerTunnel[] = await tunnelsResponse.json();
      setTunnels(tunnelsData);
    } catch (err: any) {
      console.error(`Error fetching Docker tunnels for user ${userId}:`, err);
      setErrorTunnels(err.message || 'Error al cargar los túneles Docker.');
      toast.error(err.message || 'Error al cargar los túneles Docker.');
    } finally {
      setIsLoadingTunnels(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchCloudflareData();
    }
  }, [userId, fetchCloudflareData]);

  return (
    <ScrollArea className="h-full w-full p-1">
      <div className="space-y-8 h-full">
        {/* Cloudflare Domains */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" /> Dominios de Cloudflare
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={fetchCloudflareData} disabled={isLoadingDomains} title="Refrescar">
              {isLoadingDomains ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </CardHeader>
          <CardContent>
            {isLoadingDomains && domains.length === 0 ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Cargando dominios...</p>
              </div>
            ) : errorDomains && domains.length === 0 ? (
              <div className="flex items-center justify-center h-full text-destructive">
                <AlertCircle className="h-6 w-6 mr-2" />
                <p>{errorDomains}</p>
              </div>
            ) : domains.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Este usuario no tiene dominios de Cloudflare registrados.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dominio</TableHead>
                    <TableHead>Zone ID</TableHead>
                    <TableHead>Account ID</TableHead>
                    <TableHead>Creado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domains.map((domain) => (
                    <TableRow key={domain.id}>
                      <TableCell className="font-medium">{domain.domain_name}</TableCell>
                      <TableCell className="font-mono text-xs">{domain.zone_id}</TableCell>
                      <TableCell className="font-mono text-xs">{domain.account_id}</TableCell>
                      <TableCell className="text-xs">{format(new Date(domain.created_at), 'dd/MM/yyyy', { locale: es })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* Docker Tunnels */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" /> Túneles Docker
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={fetchCloudflareData} disabled={isLoadingTunnels} title="Refrescar">
              {isLoadingTunnels ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </CardHeader>
          <CardContent>
            {isLoadingTunnels && tunnels.length === 0 ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Cargando túneles...</p>
              </div>
            ) : errorTunnels && tunnels.length === 0 ? (
              <div className="flex items-center justify-center h-full text-destructive">
                <AlertCircle className="h-6 w-6 mr-2" />
                <p>{errorTunnels}</p>
              </div>
            ) : tunnels.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Este usuario no tiene túneles Docker configurados.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dominio Completo</TableHead>
                    <TableHead>Servidor</TableHead>
                    <TableHead>Contenedor ID</TableHead>
                    <TableHead>Puerto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Creado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tunnels.map((tunnel) => (
                    <TableRow key={tunnel.id}>
                      <TableCell className="font-medium">
                        <a href={`https://${tunnel.full_domain}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
                          <Globe className="h-4 w-4" /> {tunnel.full_domain}
                        </a>
                      </TableCell>
                      <TableCell className="flex items-center gap-1 text-xs">
                        <Server className="h-3 w-3 text-muted-foreground" />
                        {tunnel.server_name}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{tunnel.container_id.substring(0, 12)}</TableCell>
                      <TableCell>{tunnel.container_port}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "flex items-center gap-1",
                          tunnel.status === 'active' && "text-green-500",
                          tunnel.status === 'failed' && "text-destructive",
                          (tunnel.status === 'pending' || tunnel.status === 'provisioning') && "text-blue-500"
                        )}>
                          {tunnel.status === 'active' && <CheckCircle2 className="h-4 w-4" />}
                          {tunnel.status === 'failed' && <AlertCircle className="h-4 w-4" />}
                          {(tunnel.status === 'pending' || tunnel.status === 'provisioning') && <Loader2 className="h-4 w-4 animate-spin" />}
                          {tunnel.status === 'pending' && 'Pendiente'}
                          {tunnel.status === 'provisioning' && 'Aprovisionando'}
                          {tunnel.status === 'active' && 'Activo'}
                          {tunnel.status === 'failed' && 'Fallido'}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">{format(new Date(tunnel.created_at), 'dd/MM/yyyy', { locale: es })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}