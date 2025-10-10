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
    <div className="mt-auto flex flex-col bg-[var(--chat-bubble-background-color)] backdrop-blur-[var(--chat-bubble-blur)] border-t border-[var(--chat-bubble-border-color)]">
      <StorageUsageIndicator onOpenStorageManagement={onOpenStorageManagement} />
      
      {/* Nuevo botón "Ver Archivos" aquí */}
      <div className="px-4 py-2">
        <Button 
          // Eliminamos variant="outline" y aplicamos estilos directos para el efecto glassmorphism
          className="w-full justify-center text-sidebar-foreground bg-transparent border border-[var(--chat-bubble-border-color)] hover:bg-white/10 hover:text-sidebar-accent-foreground"
          onClick={onOpenStorageManagement}
        >
          <HardDrive className="mr-2 h-4 w-4" /> Ver Archivos
        </Button>
      </div>

      <div className="flex items-center justify-center gap-2 px-4 py-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 relative bg-transparent border border-[var(--chat-bubble-border-color)] hover:bg-white/10 hover:text-sidebar-accent-foreground" 
                onClick={onOpenSupportTicket}
              >
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
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 bg-transparent border border-[var(--chat-bubble-border-color)] hover:bg-white/10 hover:text-sidebar-accent-foreground"
                >
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