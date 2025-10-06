"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { LifeBuoy, GitPullRequest, HardDrive } from 'lucide-react'; // Import HardDrive icon
import { VersionDisplay } from './version-display';
import { StorageUsageIndicator } from './storage-usage-indicator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarFooterProps {
  onOpenSupportTicket: () => void;
  onOpenStorageManagement: () => void;
}

export function SidebarFooter({ onOpenSupportTicket, onOpenStorageManagement }: SidebarFooterProps) {
  return (
    <div className="mt-auto flex flex-col">
      <StorageUsageIndicator onOpenStorageManagement={onOpenStorageManagement} />
      <div className="flex items-center justify-center gap-2 px-4 py-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={onOpenSupportTicket}>
                <LifeBuoy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Soporte Técnico</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={onOpenStorageManagement}>
                <HardDrive className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Ver Archivos</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <a href="https://github.com/martinpensa/deep-ai-coder/issues/new/choose" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <GitPullRequest className="h-4 w-4" />
                </Button>
              </a>
            </TooltipTrigger>
            <TooltipContent>
              <p>Sugerir una mejora</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <VersionDisplay />
    </div>
  );
}