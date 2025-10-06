"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { LifeBuoy, GitPullRequest } from 'lucide-react';
import { VersionDisplay } from './version-display';
import { StorageUsageIndicator } from './storage-usage-indicator';

interface SidebarFooterProps {
  onOpenSupportTicket: () => void;
  onOpenStorageManagement: () => void;
}

export function SidebarFooter({ onOpenSupportTicket, onOpenStorageManagement }: SidebarFooterProps) {
  return (
    <div className="mt-auto flex flex-col">
      <StorageUsageIndicator onOpenStorageManagement={onOpenStorageManagement} />
      <div className="flex flex-col items-center gap-2 px-4 py-2">
        <Button variant="outline" size="sm" className="w-full" onClick={onOpenSupportTicket}>
          <LifeBuoy className="mr-2 h-4 w-4" />
          Soporte Técnico
        </Button>
        <a href="https://github.com/martinpensa/deep-ai-coder/issues/new/choose" target="_blank" rel="noopener noreferrer" className="w-full">
          <Button variant="outline" size="sm" className="w-full">
            <GitPullRequest className="mr-2 h-4 w-4" />
            Sugerir una mejora
          </Button>
        </a>
      </div>
      <VersionDisplay />
    </div>
  );
}