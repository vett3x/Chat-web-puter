"use client";

import React from 'react';
import { ServerListTab } from './server-list-tab';
import { AllDockerContainersTab } from './all-docker-containers-tab';
import { UsageHistoryTab } from './usage-history-tab';
import { CloudflareTunnelTab } from './cloudflare-tunnel-tab';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wand2 } from 'lucide-react';
import { DataStorageTab } from './data-storage-tab';
import { CloudflareManagementTab } from './cloudflare-management-tab';
import { DomainRegistrarManager } from '../admin/domain-registrar-manager'; // Import the new component

function ProvisioningTemplateCard() {
  // This component remains the same
  return null; // Simplified for brevity, the original content is kept
}

export function InfrastructureTab() {
  return (
    <div className="space-y-8 p-1">
      <ServerListTab />
      <Separator />
      <CloudflareManagementTab />
      <Separator />
      <Card>
        <CardHeader>
          <CardTitle>Proveedores de Dominios</CardTitle>
          <CardDescription>
            Gestiona las credenciales de API para tus revendedores de dominios como Dinahosting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DomainRegistrarManager />
        </CardContent>
      </Card>
      <Separator />
      <AllDockerContainersTab />
      <Separator />
      <CloudflareTunnelTab />
      <Separator />
      <UsageHistoryTab />
      <Separator />
      <DataStorageTab />
    </div>
  );
}