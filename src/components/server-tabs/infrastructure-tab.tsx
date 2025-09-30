"use client";

import React from 'react';
import { ServerListTab } from './server-list-tab';
import { AllDockerContainersTab } from './all-docker-containers-tab';
import { UsageHistoryTab } from './usage-history-tab';
import { CloudflareTunnelTab } from './cloudflare-tunnel-tab';
import { Separator } from '@/components/ui/separator';

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
    </div>
  );
}