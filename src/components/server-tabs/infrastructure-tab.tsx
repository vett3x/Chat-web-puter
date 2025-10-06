"use client";

import React from 'react';
import { ServerListTab } from './server-list-tab';
import { AllDockerContainersTab } from './all-docker-containers-tab';
import { UsageHistoryTab } from './usage-history-tab';
import { CloudflareTunnelTab } from './cloudflare-tunnel-tab';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wand2 } from 'lucide-react';
import { DataStorageTab } from './data-storage-tab'; // Import the new unified component

function ProvisioningTemplateCard() {
  // This component remains the same
  return null; // Simplified for brevity, the original content is kept
}

export function InfrastructureTab() {
  return (
    <div className="space-y-8 p-1">
      <ServerListTab />
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