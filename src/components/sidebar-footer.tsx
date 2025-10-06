"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { LifeBuoy, GitPullRequest, HardDrive } from 'lucide-react';
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
  hasNewUserSupportTickets: boolean; // New prop
}

export function SidebarFooter({ onOpenSupportTicket, onOpenStorageManagement, hasNewUserSupportTickets }: SidebarFooterProps) {
  return (
    <div className="mt-auto flex flex-col">
      <StorageUsageIndicator onOpenStorageManagement={onOpenStorageManagement} />
      
      {/* Nuevo botón "Ver Archivos" aquí */}
      <div className="px-4 py-2">
        <Button 
          variant="outline" 
          className="w-full justify-center text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={onOpenStorageManagement}
        >
          <HardDrive className="mr-2 h-4 w-4" /> Ver Archivos
        </Button>
      </div>

      <div className="flex items-center justify-center gap-2 px-4 py-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 relative" onClick={onOpenSupportTicket}>
                {hasNewUserSupportTickets && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                )}
                <LifeBuoy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Soporte Técnico</p>
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